"""Wedding-website builder tests.

Covers the authoritative content validator, slug rules, the entitlement gate,
publish/revision/restore behaviour, cross-tenant isolation, and the billing
webhook's downgrade -> unpublish hook (the inert P1 hook, now activated by the
wedding_sites table).

The fake D1 is backed by a real in-memory SQLite loaded from schema.sql, so the
tests exercise the actual SQL (JOINs, the revision-prune subquery, the status
CHECK constraint, INTEGER-PK autoincrement) rather than a hand-rolled stand-in.
Handlers are called directly — no Workers runtime needed.
"""
import os
import sys
import json
import time
import hmac
import types
import hashlib
import asyncio
import sqlite3

import pytest

# ---------------------------------------------------------------------------
# Environment + Pyodide/runtime stubs (must precede the imports under test)
# ---------------------------------------------------------------------------
os.environ.setdefault("JWT_SECRET_KEY", "test-secret")
os.environ["ADMIN_EMAILS"] = "boss@example.com"
os.environ["STRIPE_WEBHOOK_SECRET"] = "whsec_test"

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
sys.modules["auth"] = _auth

_SRC = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "src"))
if _SRC not in sys.path:
    sys.path.insert(0, _SRC)
for _m in ("middleware", "entitlements", "db"):
    _mod = sys.modules.get(_m)
    if _mod is not None and getattr(_mod, "__file__", None) is None:
        del sys.modules[_m]

# test_auth_registration installs a stub `services` package (to keep
# email_service mocked) that has no __path__, which blocks importing real
# submodules. Give that stub the real services/ path so services.site_schema /
# services.site_cache resolve, while leaving any already-stubbed submodules
# (email_service, rate_limit) intact.
_services_pkg = sys.modules.get("services")
if _services_pkg is not None and not hasattr(_services_pkg, "__path__"):
    _services_pkg.__path__ = [os.path.abspath(os.path.join(_SRC, "services"))]

import entitlements  # noqa: E402
from fastapi import HTTPException  # noqa: E402
from services import site_schema  # noqa: E402
from routes import website_routes as wr  # noqa: E402
from routes import billing_routes  # noqa: E402

_SCHEMA = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "schema.sql"))


def run(coro):
    return asyncio.get_event_loop().run_until_complete(coro)


# ---------------------------------------------------------------------------
# SQLite-backed fake D1 (real SQL semantics)
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

    # test-only direct helpers
    def exec(self, sql, *args):
        self.conn.execute(sql, args)
        self.conn.commit()

    def one(self, sql, *args):
        row = self.conn.execute(sql, args).fetchone()
        return dict(row) if row else None


def _req(db):
    """Request whose env exposes only DB (no RATE_LIMIT -> limiter fails open)."""
    req = types.SimpleNamespace()
    req.scope = {"env": types.SimpleNamespace(DB=db)}
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
# Content validator (authoritative boundary)
# ---------------------------------------------------------------------------

def test_validator_rejects_unknown_keys():
    with pytest.raises(site_schema.ValidationError):
        site_schema.validate_document(
            {"version": 1, "blocks": [{"type": "hero", "enabled": True,
                                       "data": {"coupleNames": "A", "evil": "x"}}]}
        )


def test_validator_rejects_unknown_block_type():
    with pytest.raises(site_schema.ValidationError):
        site_schema.validate_document(
            {"version": 1, "blocks": [{"type": "scripts", "enabled": True, "data": {}}]}
        )


def test_validator_rejects_oversize_string():
    with pytest.raises(site_schema.ValidationError):
        site_schema.validate_document(
            {"version": 1, "blocks": [{"type": "story", "enabled": True,
                                       "data": {"body": "x" * 2001}}]}
        )


def test_validator_rejects_non_https_url():
    with pytest.raises(site_schema.ValidationError):
        site_schema.validate_document(
            {"version": 1, "blocks": [{"type": "hero", "enabled": True,
                                       "data": {"heroImageUrl": "http://example.com/x.jpg"}}]}
        )
    # javascript: and other schemes are likewise rejected
    with pytest.raises(site_schema.ValidationError):
        site_schema.validate_document(
            {"version": 1, "blocks": [{"type": "hero", "enabled": True,
                                       "data": {"heroImageUrl": "javascript:alert(1)"}}]}
        )


def test_validator_strips_control_chars():
    raw = "A" + chr(0) + chr(7) + chr(31) + "B"
    out = site_schema.validate_document(
        {"version": 1, "blocks": [{"type": "hero", "enabled": True,
                                   "data": {"coupleNames": raw}}]}
    )
    hero = next(b for b in out["blocks"] if b["type"] == "hero")
    assert hero["data"]["coupleNames"] == "AB"  # control chars never survive


def test_validator_accepts_https_and_normalizes_block_order():
    out = site_schema.validate_document(
        {"version": 1, "blocks": [{"type": "hero", "enabled": True,
                                   "data": {"heroImageUrl": "https://cdn.example/x.jpg"}}]}
    )
    assert [b["type"] for b in out["blocks"]] == list(site_schema.BLOCK_ORDER)
    hero = out["blocks"][0]
    assert hero["data"]["heroImageUrl"] == "https://cdn.example/x.jpg"


# ---------------------------------------------------------------------------
# Slug rules
# ---------------------------------------------------------------------------

def test_slug_reserved_rejected():
    for reserved in ("api", "admin", "w", "wedi", "www"):
        assert wr._slug_error(reserved) is not None


def test_slug_length_and_charset_rules():
    assert wr._slug_error("ab") is not None          # too short
    assert wr._slug_error("a" * 41) is not None       # too long
    assert wr._slug_error("alex-and-sam-2026") is None
    # normalization strips disallowed chars
    assert wr._normalize_slug("Alex & Sam!! 2026") == "alex-sam-2026"


def test_slug_uniqueness_enforced_on_settings():
    db = FakeD1()
    # wedding A creates its site (slug seeded from 'alex-sam')
    siteA = run(wr.get_site(wedding=_wedding("wA", "alex-sam"), request=_req(db)))
    assert siteA["slug"] == "alex-sam"
    # wedding B creates its own site, then tries to claim A's slug
    run(wr.get_site(wedding=_wedding("wB", "bob-kim"), request=_req(db)))
    with pytest.raises(HTTPException) as exc:
        run(wr.update_settings(
            wr.SettingsBody(slug="alex-sam"),
            wedding=_wedding("wB", "bob-kim"), request=_req(db),
        ))
    assert exc.value.status_code == 409


def test_slug_check_endpoint_reports_availability():
    db = FakeD1()
    run(wr.get_site(wedding=_wedding("wA", "alex-sam"), request=_req(db)))
    # reserved -> unavailable
    res = run(wr.slug_check(slug="admin", wedding=_wedding("wA", "alex-sam"), request=_req(db)))
    assert res["available"] is False
    # taken by another wedding -> unavailable
    run(wr.get_site(wedding=_wedding("wB", "bob-kim"), request=_req(db)))
    res2 = run(wr.slug_check(slug="alex-sam", wedding=_wedding("wB", "bob-kim"), request=_req(db)))
    assert res2["available"] is False
    # fresh -> available
    res3 = run(wr.slug_check(slug="totally-free-slug", wedding=_wedding("wB", "bob-kim"), request=_req(db)))
    assert res3["available"] is True


# ---------------------------------------------------------------------------
# Entitlement gate
# ---------------------------------------------------------------------------

def test_free_account_gets_403_upgrade_required():
    gate = entitlements.require_feature("website_builder")
    with pytest.raises(HTTPException) as exc:
        run(gate(wedding={"id": "wFree", "plan": "free"}))
    assert exc.value.status_code == 403
    assert exc.value.detail == {"code": "upgrade_required", "feature": "website_builder"}


def test_premium_account_passes_gate():
    gate = entitlements.require_feature("website_builder")
    assert run(gate(wedding={"id": "wA", "plan": "premium"}))["plan"] == "premium"


# ---------------------------------------------------------------------------
# Lazy create / content / settings
# ---------------------------------------------------------------------------

def test_get_site_lazily_creates_seeded_draft():
    db = FakeD1()
    site = run(wr.get_site(wedding=_wedding(), request=_req(db)))
    assert site["status"] == "draft"
    assert site["theme"] == "classic"
    assert site["has_password"] is False
    hero = next(b for b in site["content"]["blocks"] if b["type"] == "hero")
    assert hero["data"]["coupleNames"] == "Alex & Sam"
    assert site["public_path"] == "/w/alex-sam"


def test_update_content_validates_and_persists():
    db = FakeD1()
    run(wr.get_site(wedding=_wedding(), request=_req(db)))
    doc = site_schema.default_document(_wedding())
    next(b for b in doc["blocks"] if b["type"] == "hero")["data"]["tagline"] = "Save the date!"
    out = run(wr.update_content(wr.ContentBody(content=doc), wedding=_wedding(), request=_req(db)))
    hero = next(b for b in out["content"]["blocks"] if b["type"] == "hero")
    assert hero["data"]["tagline"] == "Save the date!"
    # invalid content (http url) is rejected
    bad = site_schema.default_document(_wedding())
    next(b for b in bad["blocks"] if b["type"] == "hero")["data"]["heroImageUrl"] = "http://x/y.jpg"
    with pytest.raises(HTTPException) as exc:
        run(wr.update_content(wr.ContentBody(content=bad), wedding=_wedding(), request=_req(db)))
    assert exc.value.status_code == 400


def test_update_settings_theme_password_and_invalid_theme():
    db = FakeD1()
    run(wr.get_site(wedding=_wedding(), request=_req(db)))
    out = run(wr.update_settings(
        wr.SettingsBody(theme="midnight", rsvp_enabled=False, password="hunter2pass"),
        wedding=_wedding(), request=_req(db),
    ))
    assert out["theme"] == "midnight"
    assert out["rsvp_enabled"] is False
    assert out["has_password"] is True
    # stored hash is a real PBKDF2 hash, never the plaintext
    stored = db.one("SELECT password_hash FROM wedding_sites WHERE wedding_id='wA'")
    assert stored["password_hash"].startswith("$pbkdf2-sha256$")
    # clearing the password
    out2 = run(wr.update_settings(wr.SettingsBody(password=""), wedding=_wedding(), request=_req(db)))
    assert out2["has_password"] is False
    # unknown theme rejected
    with pytest.raises(HTTPException) as exc:
        run(wr.update_settings(wr.SettingsBody(theme="neon"), wedding=_wedding(), request=_req(db)))
    assert exc.value.status_code == 400


# ---------------------------------------------------------------------------
# Publish / revisions / restore
# ---------------------------------------------------------------------------

def test_publish_freezes_snapshot_creates_revision_and_prunes_to_10():
    db = FakeD1()
    run(wr.get_site(wedding=_wedding(), request=_req(db)))
    # 12 publishes -> revisions pruned to the 10 most recent
    for _ in range(12):
        out = run(wr.publish(wedding=_wedding(), request=_req(db)))
    assert out["status"] == "published"
    assert out["published_at"] is not None

    snap = db.one("SELECT published_snapshot, draft_content FROM wedding_sites WHERE wedding_id='wA'")
    assert snap["published_snapshot"]  # frozen
    # snapshot is the validated/normalized draft
    assert json.loads(snap["published_snapshot"]) == site_schema.validate_document(
        json.loads(snap["draft_content"])
    )

    site_id = db.one("SELECT id FROM wedding_sites WHERE wedding_id='wA'")["id"]
    revs = db.conn.execute(
        "SELECT id FROM site_revisions WHERE site_id=? ORDER BY id DESC", (site_id,)
    ).fetchall()
    assert len(revs) == 10                 # pruned
    assert [r["id"] for r in revs] == list(range(12, 2, -1))  # the 10 newest (ids 3..12)


def test_restore_round_trip():
    db = FakeD1()
    run(wr.get_site(wedding=_wedding(), request=_req(db)))
    # publish version X
    docX = site_schema.default_document(_wedding())
    next(b for b in docX["blocks"] if b["type"] == "hero")["data"]["tagline"] = "Version X"
    run(wr.update_content(wr.ContentBody(content=docX), wedding=_wedding(), request=_req(db)))
    run(wr.publish(wedding=_wedding(), request=_req(db)))
    revs = run(wr.list_revisions(wedding=_wedding(), request=_req(db)))
    rev_id = revs[0]["id"]
    # edit the draft to version Y
    docY = site_schema.default_document(_wedding())
    next(b for b in docY["blocks"] if b["type"] == "hero")["data"]["tagline"] = "Version Y"
    out_y = run(wr.update_content(wr.ContentBody(content=docY), wedding=_wedding(), request=_req(db)))
    assert next(b for b in out_y["content"]["blocks"] if b["type"] == "hero")["data"]["tagline"] == "Version Y"
    # restore the X revision -> draft is X again
    restored = run(wr.restore_revision(rev_id, wedding=_wedding(), request=_req(db)))
    tag = next(b for b in restored["content"]["blocks"] if b["type"] == "hero")["data"]["tagline"]
    assert tag == "Version X"


def test_unpublish_sets_status():
    db = FakeD1()
    run(wr.get_site(wedding=_wedding(), request=_req(db)))
    run(wr.publish(wedding=_wedding(), request=_req(db)))
    out = run(wr.unpublish(wedding=_wedding(), request=_req(db)))
    assert out["status"] == "unpublished"


def test_revision_of_wedding_A_not_restorable_by_wedding_B():
    db = FakeD1()
    # wedding A publishes -> owns a revision
    run(wr.get_site(wedding=_wedding("wA", "alex-sam"), request=_req(db)))
    run(wr.publish(wedding=_wedding("wA", "alex-sam"), request=_req(db)))
    a_rev = run(wr.list_revisions(wedding=_wedding("wA", "alex-sam"), request=_req(db)))[0]["id"]
    # wedding B has its own site but must not touch A's revision
    run(wr.get_site(wedding=_wedding("wB", "bob-kim"), request=_req(db)))
    with pytest.raises(HTTPException) as exc:
        run(wr.restore_revision(a_rev, wedding=_wedding("wB", "bob-kim"), request=_req(db)))
    assert exc.value.status_code == 404


# ---------------------------------------------------------------------------
# Billing webhook: downgrade -> unpublish (activates the P1 hook)
# ---------------------------------------------------------------------------

def _webhook_req(event, db, secret="whsec_test"):
    raw = json.dumps(event).encode()
    ts = int(time.time())
    sig = hmac.new(secret.encode(), f"{ts}.".encode() + raw, hashlib.sha256).hexdigest()
    req = types.SimpleNamespace()
    async def body():
        return raw
    req.body = body
    req.headers = types.SimpleNamespace(
        get=lambda k, d=None: f"t={ts},v1={sig}" if k == "Stripe-Signature" else d
    )
    req.scope = {"env": types.SimpleNamespace(DB=db)}
    return req


def test_downgrade_webhook_unpublishes_site():
    db = FakeD1()
    # A premium wedding with a published site and an active subscription.
    db.exec(
        "INSERT INTO weddings (id, slug, owner_id, plan, stripe_subscription_id, is_active) "
        "VALUES ('wPub', 'pub', 'ghost', 'premium', 'sub_pub', 1)"
    )
    db.exec(
        "INSERT INTO wedding_sites (wedding_id, slug, status, published_snapshot) "
        "VALUES ('wPub', 'pub-site', 'published', '{}')"
    )
    event = {
        "id": "evt_unpub", "type": "customer.subscription.deleted",
        "data": {"object": {"id": "sub_pub"}},
    }
    run(billing_routes.stripe_webhook(_webhook_req(event, db)))
    wedding = db.one("SELECT plan FROM weddings WHERE id='wPub'")
    site = db.one("SELECT status FROM wedding_sites WHERE wedding_id='wPub'")
    assert wedding["plan"] == "free"           # downgraded
    assert site["status"] == "unpublished"     # P1 hook now operates correctly
