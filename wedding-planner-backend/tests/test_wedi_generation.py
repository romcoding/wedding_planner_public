"""Tests for "Wedi designs your website" — generation + the HARD cost controls.

The Anthropic HTTP call is mocked at ``ai_service.call_claude_json`` (the single
gated code path), so no network or key is needed and we can assert exactly how
many model calls a request makes. The fake D1 is the same real-SQLite-backed
stand-in used by test_website, loaded from schema.sql, so the wedi ledger tables,
the UNIQUE(wedding_id, period) UPSERT and the status CHECK all run for real.

Covered: monthly generation cap (31st blocked), token-budget exhaustion, implicit
new-period reset, usage recorded from actuals, kill switch, free-plan gate,
invalid-JSON one-retry-then-friendly-error, schema-failing output never reaching
the draft, HTML-tag rejection, refine merge + re-validation, per-minute velocity,
and the budget-before-model-call ordering (zero model calls when over limit).
"""
import os
import sys
import json
import types
import asyncio
import sqlite3

import pytest

# ---------------------------------------------------------------------------
# Environment + Pyodide/runtime stubs (must precede the imports under test)
# ---------------------------------------------------------------------------
os.environ.setdefault("JWT_SECRET_KEY", "test-secret")
os.environ.setdefault("ADMIN_EMAILS", "boss@example.com")

for _n in ("workers", "asgi", "js"):
    sys.modules.setdefault(_n, types.ModuleType(_n))

# Stub `auth` so the env's native jwt/cryptography is never imported.
_auth = types.ModuleType("auth")
async def _require_couple_auth(request=None):
    return {"sub": "user"}
_auth.require_couple_auth = _require_couple_auth
_auth.decode_token = lambda t: {}
_auth.create_token = lambda *a, **k: "t"
_auth.create_guest_token = lambda *a, **k: "g"
sys.modules.setdefault("auth", _auth)

_SRC = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "src"))
if _SRC not in sys.path:
    sys.path.insert(0, _SRC)
for _m in ("middleware", "entitlements", "db"):
    _mod = sys.modules.get(_m)
    if _mod is not None and getattr(_mod, "__file__", None) is None:
        del sys.modules[_m]

# Give any stubbed `services` package the real path so services.* resolve to the
# real modules (mirror of the test_website fixup).
_services_pkg = sys.modules.get("services")
if _services_pkg is not None and not hasattr(_services_pkg, "__path__"):
    _services_pkg.__path__ = [os.path.abspath(os.path.join(_SRC, "services"))]

import entitlements  # noqa: E402
from fastapi import HTTPException  # noqa: E402
from services import ai_service, site_schema, usage  # noqa: E402
from routes import website_routes as wr  # noqa: E402

_SCHEMA = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "schema.sql"))


def run(coro):
    return asyncio.get_event_loop().run_until_complete(coro)


# ---------------------------------------------------------------------------
# SQLite-backed fake D1 (real SQL semantics) + fake KV
# ---------------------------------------------------------------------------

class _Result:
    def __init__(self, results):
        self.results = results


class _Stmt:
    def __init__(self, conn, sql):
        self.conn = conn
        self.sql = sql
        self.args = []

    def bind(self, *args):
        self.args = list(args)
        return self

    async def first(self):
        row = self.conn.execute(self.sql, self.args).fetchone()
        return dict(row) if row is not None else None

    async def all(self):
        rows = self.conn.execute(self.sql, self.args).fetchall()
        return _Result([dict(r) for r in rows])

    async def run(self):
        self.conn.execute(self.sql, self.args)
        self.conn.commit()
        return None


class FakeD1:
    def __init__(self):
        self.conn = sqlite3.connect(":memory:")
        self.conn.row_factory = sqlite3.Row
        with open(_SCHEMA) as fh:
            self.conn.executescript(fh.read())

    def prepare(self, sql):
        return _Stmt(self.conn, sql)

    def exec(self, sql, *args):
        self.conn.execute(sql, args)
        self.conn.commit()

    def one(self, sql, *args):
        row = self.conn.execute(sql, args).fetchone()
        return dict(row) if row else None


class _FakeKV:
    """In-memory stand-in for a Cloudflare KV namespace."""

    def __init__(self):
        self.store = {}

    async def get(self, key):
        return self.store.get(key)

    async def put(self, key, value, options=None):
        self.store[key] = value


def _req(db, **env):
    """Request whose env exposes DB (+ optional extra bindings/vars)."""
    e = types.SimpleNamespace(DB=db, **env)
    req = types.SimpleNamespace()
    req.scope = {"env": e}
    req.headers = types.SimpleNamespace(get=lambda k, d=None: d)
    return req


def _wedding(wid="wA", slug="alex-sam", plan="premium"):
    return {
        "id": wid,
        "plan": plan,
        "slug": slug,
        "partner_one_name": "Alex",
        "partner_two_name": "Sam",
        "wedding_date": "2026-09-12",
        "location": "Lake Como",
    }


# ---------------------------------------------------------------------------
# Mock for the single Anthropic code path (ai_service.call_claude_json)
# ---------------------------------------------------------------------------

def _fake_caller(text, usage_actuals=None):
    """Return (fake, state). *text* may be a string or fn(call_n)->string."""
    usage_actuals = usage_actuals or {"input_tokens": 100, "output_tokens": 200}
    state = {"calls": 0, "last_user": None}

    def fake(system_prompt, user_message, *, model=None, max_tokens=None,
             temperature=None, timeout=None):
        state["calls"] += 1
        state["last_user"] = user_message
        body = text(state["calls"]) if callable(text) else text
        return {"content": [{"text": body}], "usage": dict(usage_actuals)}

    return fake, state


def _valid_doc(tagline="We are getting married"):
    return json.dumps({
        "version": 1,
        "blocks": [
            {"type": "hero", "enabled": True,
             "data": {"coupleNames": "Alex & Sam", "tagline": tagline}},
        ],
    })


def _seed_usage(db, wid, period, generations=0, input_tokens=0, output_tokens=0):
    db.exec(
        "INSERT INTO wedi_site_usage (wedding_id, period, generations, input_tokens, output_tokens) "
        "VALUES (?, ?, ?, ?, ?)",
        wid, period, generations, input_tokens, output_tokens,
    )


# ---------------------------------------------------------------------------
# Entitlement gate
# ---------------------------------------------------------------------------

def test_free_plan_blocked_by_gate():
    gate = entitlements.require_feature("wedi_site_generation")
    with pytest.raises(HTTPException) as exc:
        run(gate(wedding={"id": "wFree", "plan": "free"}))
    assert exc.value.status_code == 403
    assert exc.value.detail == {"code": "upgrade_required", "feature": "wedi_site_generation"}


def test_premium_and_lifetime_have_wedi_feature():
    assert entitlements.plan_has_feature("premium", "wedi_site_generation")
    assert entitlements.plan_has_feature("lifetime", "wedi_site_generation")
    assert not entitlements.plan_has_feature("free", "wedi_site_generation")


# ---------------------------------------------------------------------------
# Happy path: usage recorded from ACTUALS, draft updated (never published)
# ---------------------------------------------------------------------------

def test_records_usage_from_actuals_and_returns_remaining(monkeypatch):
    db = FakeD1()
    fake, state = _fake_caller(_valid_doc("Save the date"),
                               usage_actuals={"input_tokens": 123, "output_tokens": 456})
    monkeypatch.setattr(ai_service, "call_claude_json", fake)

    out = run(wr.generate(wr.GenerateBody(prompt="lakeside vineyard", mode="full"),
                          wedding=_wedding(), request=_req(db)))

    assert state["calls"] == 1
    hero = next(b for b in out["content"]["blocks"] if b["type"] == "hero")
    assert hero["data"]["tagline"] == "Save the date"
    assert out["remaining_generations"] == 29

    row = db.one("SELECT generations, input_tokens, output_tokens FROM wedi_site_usage WHERE wedding_id='wA'")
    assert row == {"generations": 1, "input_tokens": 123, "output_tokens": 456}

    log = db.one("SELECT status, input_tokens, output_tokens, purpose FROM wedi_generation_log WHERE wedding_id='wA'")
    assert log["status"] == "ok"
    assert (log["input_tokens"], log["output_tokens"], log["purpose"]) == (123, 456, "full")

    site = db.one("SELECT status, draft_content, published_snapshot FROM wedding_sites WHERE wedding_id='wA'")
    assert site["status"] == "draft"               # never auto-published
    assert site["published_snapshot"] is None
    assert json.loads(site["draft_content"]) == out["content"]


def test_strips_code_fences_from_model_output(monkeypatch):
    db = FakeD1()
    fenced = "```json\n" + _valid_doc("Fenced") + "\n```"
    fake, _ = _fake_caller(fenced)
    monkeypatch.setattr(ai_service, "call_claude_json", fake)
    out = run(wr.generate(wr.GenerateBody(prompt="hi"), wedding=_wedding(), request=_req(db)))
    hero = next(b for b in out["content"]["blocks"] if b["type"] == "hero")
    assert hero["data"]["tagline"] == "Fenced"


# ---------------------------------------------------------------------------
# Monthly budget — generations + tokens, implicit reset
# ---------------------------------------------------------------------------

def test_thirty_first_generation_blocked(monkeypatch):
    db = FakeD1()
    _seed_usage(db, "wA", usage.current_period(), generations=30)
    fake, state = _fake_caller(_valid_doc())
    monkeypatch.setattr(ai_service, "call_claude_json", fake)
    with pytest.raises(HTTPException) as exc:
        run(wr.generate(wr.GenerateBody(prompt="hi"), wedding=_wedding(), request=_req(db)))
    assert exc.value.status_code == 429
    assert exc.value.detail["code"] == "wedi_limit"
    assert "resets on" in exc.value.detail["detail"]


def test_token_budget_exhaustion_blocked(monkeypatch):
    db = FakeD1()
    # total tokens == the 400000 monthly cap -> next call refused
    _seed_usage(db, "wA", usage.current_period(), generations=2,
                input_tokens=200000, output_tokens=200000)
    fake, state = _fake_caller(_valid_doc())
    monkeypatch.setattr(ai_service, "call_claude_json", fake)
    with pytest.raises(HTTPException) as exc:
        run(wr.generate(wr.GenerateBody(prompt="hi"), wedding=_wedding(), request=_req(db)))
    assert exc.value.status_code == 429
    assert exc.value.detail["code"] == "wedi_limit"
    assert state["calls"] == 0


def test_new_period_resets_budget_implicitly(monkeypatch):
    db = FakeD1()
    # An ancient, fully-exhausted period must not affect the current one.
    _seed_usage(db, "wA", "2000-01", generations=30, input_tokens=400000, output_tokens=0)
    fake, state = _fake_caller(_valid_doc())
    monkeypatch.setattr(ai_service, "call_claude_json", fake)
    out = run(wr.generate(wr.GenerateBody(prompt="hi"), wedding=_wedding(), request=_req(db)))
    assert state["calls"] == 1
    assert out["remaining_generations"] == 29


def test_budget_check_precedes_model_call(monkeypatch):
    db = FakeD1()
    _seed_usage(db, "wA", usage.current_period(), generations=30)
    fake, state = _fake_caller(_valid_doc())
    monkeypatch.setattr(ai_service, "call_claude_json", fake)
    with pytest.raises(HTTPException) as exc:
        run(wr.generate(wr.GenerateBody(prompt="hi"), wedding=_wedding(), request=_req(db)))
    assert exc.value.status_code == 429
    assert state["calls"] == 0  # zero model invocations when over budget


# ---------------------------------------------------------------------------
# Kill switch + velocity
# ---------------------------------------------------------------------------

def test_kill_switch_returns_503(monkeypatch):
    db = FakeD1()
    fake, state = _fake_caller(_valid_doc())
    monkeypatch.setattr(ai_service, "call_claude_json", fake)
    with pytest.raises(HTTPException) as exc:
        run(wr.generate(wr.GenerateBody(prompt="hi"), wedding=_wedding(),
                        request=_req(db, WEDI_GENERATION_DISABLED="1")))
    assert exc.value.status_code == 503
    assert exc.value.detail["code"] == "wedi_paused"
    assert state["calls"] == 0


def test_velocity_limit_returns_slow_down(monkeypatch):
    db = FakeD1()
    kv = _FakeKV()
    kv.store["rl:wedi:wA"] = "5"  # already at the per-minute limit
    fake, state = _fake_caller(_valid_doc())
    monkeypatch.setattr(ai_service, "call_claude_json", fake)
    with pytest.raises(HTTPException) as exc:
        run(wr.generate(wr.GenerateBody(prompt="hi"), wedding=_wedding(),
                        request=_req(db, RATE_LIMIT=kv)))
    assert exc.value.status_code == 429
    assert exc.value.detail["code"] == "slow_down"
    assert state["calls"] == 0


# ---------------------------------------------------------------------------
# Output validation: invalid JSON, schema failures, HTML tags
# ---------------------------------------------------------------------------

def test_invalid_json_retries_once_then_friendly_error(monkeypatch):
    db = FakeD1()
    run(wr.get_site(wedding=_wedding(), request=_req(db)))
    before = db.one("SELECT draft_content FROM wedding_sites WHERE wedding_id='wA'")["draft_content"]
    fake, state = _fake_caller("this is definitely not json")
    monkeypatch.setattr(ai_service, "call_claude_json", fake)

    with pytest.raises(HTTPException) as exc:
        run(wr.generate(wr.GenerateBody(prompt="hi"), wedding=_wedding(), request=_req(db)))
    assert exc.value.status_code == 502
    assert exc.value.detail["code"] == "wedi_failed"
    assert state["calls"] == 2  # initial + exactly one retry

    after = db.one("SELECT draft_content FROM wedding_sites WHERE wedding_id='wA'")["draft_content"]
    assert after == before  # draft untouched on failure
    assert db.one("SELECT status FROM wedi_generation_log WHERE wedding_id='wA'")["status"] == "error"
    assert db.one("SELECT COUNT(*) c FROM wedi_site_usage WHERE wedding_id='wA'")["c"] == 0


def test_schema_failing_output_never_touches_draft(monkeypatch):
    db = FakeD1()
    run(wr.get_site(wedding=_wedding(), request=_req(db)))
    before = db.one("SELECT draft_content FROM wedding_sites WHERE wedding_id='wA'")["draft_content"]
    bad = json.dumps({"version": 1, "blocks": [
        {"type": "hero", "enabled": True, "data": {"unknownKey": "x"}}]})
    fake, state = _fake_caller(bad)
    monkeypatch.setattr(ai_service, "call_claude_json", fake)

    with pytest.raises(HTTPException) as exc:
        run(wr.generate(wr.GenerateBody(prompt="hi"), wedding=_wedding(), request=_req(db)))
    assert exc.value.status_code == 502
    assert state["calls"] == 2
    after = db.one("SELECT draft_content FROM wedding_sites WHERE wedding_id='wA'")["draft_content"]
    assert after == before
    assert db.one("SELECT COUNT(*) c FROM wedi_site_usage WHERE wedding_id='wA'")["c"] == 0


def test_html_tag_output_rejected(monkeypatch):
    db = FakeD1()
    run(wr.get_site(wedding=_wedding(), request=_req(db)))
    before = db.one("SELECT draft_content FROM wedding_sites WHERE wedding_id='wA'")["draft_content"]
    html = json.dumps({"version": 1, "blocks": [
        {"type": "hero", "enabled": True, "data": {"tagline": "<b>hi</b>"}}]})
    fake, state = _fake_caller(html)
    monkeypatch.setattr(ai_service, "call_claude_json", fake)

    with pytest.raises(HTTPException) as exc:
        run(wr.generate(wr.GenerateBody(prompt="hi"), wedding=_wedding(), request=_req(db)))
    assert exc.value.status_code == 502
    assert state["calls"] == 2
    after = db.one("SELECT draft_content FROM wedding_sites WHERE wedding_id='wA'")["draft_content"]
    assert after == before


# ---------------------------------------------------------------------------
# Refine: merge partial blocks server-side, then re-validate the merged document
# ---------------------------------------------------------------------------

def test_refine_merges_partial_and_preserves_other_blocks(monkeypatch):
    db = FakeD1()
    run(wr.get_site(wedding=_wedding(), request=_req(db)))
    doc = site_schema.default_document(_wedding())
    next(b for b in doc["blocks"] if b["type"] == "hero")["data"]["tagline"] = "Original tagline"
    run(wr.update_content(wr.ContentBody(content=doc), wedding=_wedding(), request=_req(db)))

    partial = json.dumps({"version": 1, "blocks": [
        {"type": "hero", "enabled": True, "data": {"tagline": "Refined by Wedi"}}]})
    fake, state = _fake_caller(partial)
    monkeypatch.setattr(ai_service, "call_claude_json", fake)

    out = run(wr.generate(wr.GenerateBody(prompt="make it warmer", mode="refine"),
                          wedding=_wedding(), request=_req(db)))
    hero = next(b for b in out["content"]["blocks"] if b["type"] == "hero")
    venue = next(b for b in out["content"]["blocks"] if b["type"] == "venue")
    assert hero["data"]["tagline"] == "Refined by Wedi"   # changed field applied
    assert hero["data"]["coupleNames"] == "Alex & Sam"    # other hero field preserved
    assert venue["data"]["address"] == "Lake Como"        # untouched block preserved
    assert db.one("SELECT purpose FROM wedi_generation_log WHERE wedding_id='wA'")["purpose"] == "refine"


def test_refine_revalidates_merged_document_and_rejects_bad_merge(monkeypatch):
    db = FakeD1()
    run(wr.get_site(wedding=_wedding(), request=_req(db)))
    before = db.one("SELECT draft_content FROM wedding_sites WHERE wedding_id='wA'")["draft_content"]
    # tagline beyond the 300-char limit -> the MERGED doc must fail validation
    partial = json.dumps({"version": 1, "blocks": [
        {"type": "hero", "enabled": True, "data": {"tagline": "x" * 400}}]})
    fake, state = _fake_caller(partial)
    monkeypatch.setattr(ai_service, "call_claude_json", fake)

    with pytest.raises(HTTPException) as exc:
        run(wr.generate(wr.GenerateBody(prompt="x", mode="refine"),
                        wedding=_wedding(), request=_req(db)))
    assert exc.value.status_code == 502
    assert state["calls"] == 2
    after = db.one("SELECT draft_content FROM wedding_sites WHERE wedding_id='wA'")["draft_content"]
    assert after == before


# ---------------------------------------------------------------------------
# Status endpoint
# ---------------------------------------------------------------------------

def test_generation_status_reports_usage(monkeypatch):
    db = FakeD1()
    fake, _ = _fake_caller(_valid_doc())
    monkeypatch.setattr(ai_service, "call_claude_json", fake)
    run(wr.generate(wr.GenerateBody(prompt="hi"), wedding=_wedding(), request=_req(db)))

    st = run(wr.generation_status(wedding=_wedding(), request=_req(db)))
    assert st["used"] == 1
    assert st["limit"] == 30
    assert st["resetsOn"].endswith("-01")


def test_prompt_over_1500_chars_rejected(monkeypatch):
    db = FakeD1()
    fake, state = _fake_caller(_valid_doc())
    monkeypatch.setattr(ai_service, "call_claude_json", fake)
    with pytest.raises(HTTPException) as exc:
        run(wr.generate(wr.GenerateBody(prompt="x" * 1501), wedding=_wedding(), request=_req(db)))
    assert exc.value.status_code == 400
    assert exc.value.detail["code"] == "prompt_too_long"
    assert state["calls"] == 0
