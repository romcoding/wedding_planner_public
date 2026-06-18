"""Onboarding recovery / no-wedding signalling (Bug 1).

Covers the BLOCKER where an account with no resolvable wedding got a 403 on
every wedding-scoped route, and quick-setup deadlocked because it depended on the
very wedding it was meant to create.

Like test_e2e_flows.py, the fake D1 is a real in-memory SQLite loaded from
schema.sql and the handlers are called directly — no Workers runtime.
"""
import os
import sys
import types
import inspect
import asyncio
import sqlite3

import pytest

os.environ.setdefault("JWT_SECRET_KEY", "test-secret")
os.environ["ADMIN_EMAILS"] = "boss@example.com"

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

from fastapi import HTTPException  # noqa: E402
import middleware  # noqa: E402
import entitlements  # noqa: E402
from routes import onboarding_routes  # noqa: E402
from routes.onboarding_routes import quick_setup, QuickSetupBody  # noqa: E402
from routes.task_routes import create_task, TaskBody  # noqa: E402

_SCHEMA = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "schema.sql"))


def run(coro):
    return asyncio.get_event_loop().run_until_complete(coro)


# --- fake D1 / request (same shape as test_e2e_flows.py) --------------------

class _Result:
    def __init__(self, results):
        self.results = results


class _Stmt:
    def __init__(self, conn, sql):
        self.conn, self.sql, self.args = conn, sql, []

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

    def one(self, sql, *a):
        row = self.conn.execute(sql, a).fetchone()
        return dict(row) if row else None

    def count(self, sql, *a):
        return self.conn.execute(sql, a).fetchone()[0]


def _req(db):
    req = types.SimpleNamespace()
    req.scope = {"env": types.SimpleNamespace(DB=db)}
    req.headers = types.SimpleNamespace(get=lambda k, d=None: d)
    return req


def _add_user(db, user_id="u1", email="couple@example.com", current_wedding_id=None):
    db.conn.execute(
        "INSERT INTO users (id, email, password_hash, name, role, current_wedding_id) "
        "VALUES (?, ?, 'x', 'Couple', 'admin', ?)",
        (user_id, email, current_wedding_id),
    )
    db.conn.commit()


# ---------------------------------------------------------------------------
# get_wedding now 409s (not 403) with code no_wedding
# ---------------------------------------------------------------------------

def test_get_wedding_raises_409_no_wedding_when_none_resolves():
    db = FakeD1()
    _add_user(db, "u1")
    with pytest.raises(HTTPException) as exc:
        run(middleware.get_wedding(payload={"sub": "u1"}, request=_req(db)))
    assert exc.value.status_code == 409
    assert isinstance(exc.value.detail, dict)
    assert exc.value.detail.get("code") == "no_wedding"


# ---------------------------------------------------------------------------
# quick_setup creates + links a wedding (no get_wedding dependency)
# ---------------------------------------------------------------------------

def test_quick_setup_signature_has_no_wedding_dependency():
    params = inspect.signature(quick_setup).parameters
    assert "wedding" not in params  # no longer injected via get_wedding


def test_quick_setup_with_no_wedding_creates_and_links_one():
    db = FakeD1()
    _add_user(db, "u1")
    assert db.count("SELECT COUNT(*) FROM weddings") == 0

    out = run(quick_setup(body=QuickSetupBody(couple_names="Ada & Bo"),
                          payload={"sub": "u1"}, request=_req(db)))
    assert out["message"] == "Quick setup completed"

    wedding = db.one("SELECT * FROM weddings WHERE owner_id = 'u1'")
    assert wedding is not None and wedding["is_active"] == 1 and wedding["plan"] == "free"
    # current_wedding_id now points at the freshly created wedding.
    user = db.one("SELECT current_wedding_id FROM users WHERE id = 'u1'")
    assert user["current_wedding_id"] == wedding["id"]
    # Seeding ran against the new wedding.
    assert db.count("SELECT COUNT(*) FROM tasks WHERE wedding_id = ?", wedding["id"]) > 0


def test_quick_setup_self_heals_dangling_current_wedding_id():
    db = FakeD1()
    _add_user(db, "u1", current_wedding_id="ghost-id-that-does-not-exist")

    run(quick_setup(body=QuickSetupBody(couple_names="Cy & Di"),
                    payload={"sub": "u1"}, request=_req(db)))

    wedding = db.one("SELECT * FROM weddings WHERE owner_id = 'u1'")
    assert wedding is not None
    user = db.one("SELECT current_wedding_id FROM users WHERE id = 'u1'")
    # The stale pointer was overwritten with a valid wedding id.
    assert user["current_wedding_id"] == wedding["id"]
    assert user["current_wedding_id"] != "ghost-id-that-does-not-exist"


def test_quick_setup_reuses_existing_owned_wedding():
    db = FakeD1()
    _add_user(db, "u1")
    db.conn.execute(
        "INSERT INTO weddings (id, slug, owner_id, plan, is_active) "
        "VALUES ('w-existing', 'ada-bo-2026', 'u1', 'premium', 1)"
    )
    db.conn.commit()

    run(quick_setup(body=QuickSetupBody(), payload={"sub": "u1"}, request=_req(db)))
    # No second wedding created — the existing one is reused (and pointer healed).
    assert db.count("SELECT COUNT(*) FROM weddings WHERE owner_id = 'u1'") == 1
    assert db.one("SELECT current_wedding_id FROM users WHERE id='u1'")["current_wedding_id"] == "w-existing"


# ---------------------------------------------------------------------------
# A wedding-scoped route works AFTER onboarding creates the wedding
# ---------------------------------------------------------------------------

def test_tasks_create_works_after_onboarding_creates_wedding():
    db = FakeD1()
    _add_user(db, "u1")
    # Before onboarding: get_wedding 409s.
    with pytest.raises(HTTPException) as exc:
        run(middleware.get_wedding(payload={"sub": "u1"}, request=_req(db)))
    assert exc.value.status_code == 409

    # Onboarding creates the wedding.
    run(quick_setup(body=QuickSetupBody(couple_names="Eli & Fi"),
                    payload={"sub": "u1"}, request=_req(db)))

    # Now get_wedding resolves and a wedding-scoped route (task create) succeeds.
    wedding = run(middleware.get_wedding(payload={"sub": "u1"}, request=_req(db)))
    created = run(create_task(body=TaskBody(title="Book caterer"),
                             wedding=wedding, request=_req(db)))
    assert created["title"] == "Book caterer"
    assert db.count("SELECT COUNT(*) FROM tasks WHERE wedding_id = ?", wedding["id"]) >= 1


# ---------------------------------------------------------------------------
# A real 403 entitlement block stays 403 — never confused with no_wedding
# ---------------------------------------------------------------------------

def test_real_entitlement_block_stays_403_not_no_wedding():
    gate = entitlements.require_feature("seating")
    with pytest.raises(HTTPException) as exc:
        run(gate(wedding={"id": "w", "plan": "free"}))
    assert exc.value.status_code == 403
    assert exc.value.detail == {"code": "upgrade_required", "feature": "seating"}
