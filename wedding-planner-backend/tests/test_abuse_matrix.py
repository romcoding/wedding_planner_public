"""Abuse sweep — parametrized over the route table (Phase 3 #10).

  * A free account is blocked (403 upgrade_required) on EVERY gated module — by
    importing each route module and exercising the very gate dependency it wired.
  * A premium account passes the same gates.
  * The unauthenticated /track ingest is durably rate limited (flood -> 429).

Cross-tenant (wedding A vs B -> 404) and the Wedi velocity/budget/kill-switch and
public-RSVP flood/honeypot cases are covered in test_tenant_isolation.py,
test_wedi_generation.py and test_public_site.py respectively.
"""
import os
import sys
import types
import sqlite3
import asyncio

import pytest

# ---------------------------------------------------------------------------
# Environment + Pyodide/runtime stubs (must precede the imports under test)
# ---------------------------------------------------------------------------
os.environ.setdefault("JWT_SECRET_KEY", "test-secret")
os.environ.setdefault("ADMIN_EMAILS", "boss@example.com")

for _n in ("workers", "asgi", "js"):
    sys.modules.setdefault(_n, types.ModuleType(_n))

_auth = types.ModuleType("auth")
async def _require_couple_auth(request=None):
    return {"sub": "user"}
_auth.require_couple_auth = _require_couple_auth
_auth.require_admin_auth = _require_couple_auth
_auth.decode_token = lambda t: {}
_auth.create_token = lambda *a, **k: "t"
_auth.create_guest_token = lambda *a, **k: "g"
sys.modules["auth"] = _auth

_SRC = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "src"))
if _SRC not in sys.path:
    sys.path.insert(0, _SRC)

# Force the real middleware/entitlements/db (a sibling test may have stubbed them).
for _m in ("middleware", "entitlements", "db"):
    _mod = sys.modules.get(_m)
    if _mod is not None and getattr(_mod, "__file__", None) is None:
        del sys.modules[_m]

# Let any stubbed `services` package still resolve genuine submodules.
_services_pkg = sys.modules.get("services")
if _services_pkg is not None and not hasattr(_services_pkg, "__path__"):
    _services_pkg.__path__ = [os.path.join(_SRC, "services")]

import importlib  # noqa: E402
from fastapi import HTTPException  # noqa: E402

_SCHEMA = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "schema.sql"))


def run(coro):
    return asyncio.get_event_loop().run_until_complete(coro)


# ---------------------------------------------------------------------------
# Free vs premium across EVERY gated module
# ---------------------------------------------------------------------------

# (route module, gate attribute, feature) — the premium-only gates. agenda is a
# FREE feature, so it is intentionally excluded.
GATED = [
    ("event_routes", "_gate", "events"),
    ("invitation_routes", "_gate", "invitations"),
    ("cost_routes", "_full_budget", "full_budget"),
    ("message_routes", "_gate", "messages"),
    ("moodboard_routes", "_gate", "moodboard"),
    ("rsvp_reminder_routes", "_gate", "rsvp_reminders"),
    ("venue_routes", "_gate", "venue"),
    ("guest_photo_routes", "_gate", "guest_photos"),
    ("gift_registry_routes", "_gate", "gift_registry"),
    ("seating_routes", "_gate", "seating"),
    ("website_routes", "_gate", "website_builder"),
    ("website_routes", "_wedi_gate", "wedi_site_generation"),
]


def _gate_for(modname, attr):
    mod = importlib.import_module(f"routes.{modname}")
    return getattr(mod, attr)


@pytest.mark.parametrize("modname,attr,feature", GATED, ids=[f"{m}.{a}" for m, a, _ in GATED])
def test_free_plan_blocked_on_every_gated_module(modname, attr, feature):
    gate = _gate_for(modname, attr)
    with pytest.raises(HTTPException) as exc:
        run(gate(wedding={"id": "wA", "plan": "free"}))
    assert exc.value.status_code == 403
    assert exc.value.detail == {"code": "upgrade_required", "feature": feature}


@pytest.mark.parametrize("modname,attr,feature", GATED, ids=[f"{m}.{a}" for m, a, _ in GATED])
def test_premium_plan_allowed_on_every_gated_module(modname, attr, feature):
    gate = _gate_for(modname, attr)
    out = run(gate(wedding={"id": "wA", "plan": "premium"}))
    assert out["plan"] == "premium"


# ---------------------------------------------------------------------------
# /track flood -> 429
# ---------------------------------------------------------------------------

class _Stmt:
    def __init__(self, conn, sql):
        self.conn, self.sql, self.args = conn, sql, []

    def bind(self, *args):
        self.args = list(args)
        return self

    async def first(self):
        row = self.conn.execute(self.sql, self.args).fetchone()
        return dict(row) if row else None

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

    def count(self, sql, *a):
        return self.conn.execute(sql, a).fetchone()[0]


class FakeKV:
    def __init__(self):
        self.store = {}

    async def get(self, key):
        return self.store.get(key)

    async def put(self, key, value, options=None):
        self.store[key] = value


def _req(db, kv, ip="7.7.7.7"):
    req = types.SimpleNamespace()
    hdrs = {"cf-connecting-ip": ip}
    req.headers = types.SimpleNamespace(get=lambda k, d=None: hdrs.get(k.lower(), d))
    req.client = None
    req.scope = {"env": types.SimpleNamespace(DB=db, RATE_LIMIT=kv)}
    return req


def test_track_flood_is_rate_limited_to_60_per_hour():
    from routes import analytics_routes as ar
    db, kv = FakeD1(), FakeKV()
    body = ar.PageViewBody(path="/", referrer=None, user_agent="ua")

    ok = 0
    for _ in range(60):
        run(ar.track_page_view(body=body, request=_req(db, kv)))
        ok += 1
    assert ok == 60

    with pytest.raises(HTTPException) as exc:
        run(ar.track_page_view(body=body, request=_req(db, kv)))   # the 61st
    assert exc.value.status_code == 429
    assert db.count("SELECT COUNT(*) FROM page_views") == 60        # the 61st wrote nothing
