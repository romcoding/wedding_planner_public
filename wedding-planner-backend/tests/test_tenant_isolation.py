"""Cross-tenant isolation tests.

A token/context for wedding A must never reach wedding B's resources: by-id
queries are scoped (404 on a miss), and platform-only endpoints reject a normal
couple (403). Handlers are called directly with a fake D1 so no Workers runtime
is needed.
"""
import os
import re
import sys
import types
import asyncio

import pytest

os.environ.setdefault("JWT_SECRET_KEY", "test-secret")
os.environ["ADMIN_EMAILS"] = "boss@example.com"

for _n in ("workers", "asgi", "js"):
    sys.modules.setdefault(_n, types.ModuleType(_n))

# Stub `auth` (avoid native jwt). decode_token is overridden per-test.
_auth = types.ModuleType("auth")
async def _require_couple_auth(request=None):
    return {"sub": "userA"}
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
from middleware import require_platform_admin  # noqa: E402
from routes.event_routes import update_event, EventBody  # noqa: E402
from routes.image_routes import delete_image  # noqa: E402
from routes.moodboard_routes import get_moodboard  # noqa: E402
from routes.seating_routes import assign_seat, AssignBody  # noqa: E402
from routes.message_routes import create_message, MessageBody  # noqa: E402
import routes.guest_photo_routes as _gpr  # noqa: E402
from routes.guest_photo_routes import upload_photo, PhotoBody  # noqa: E402


def run(coro):
    return asyncio.get_event_loop().run_until_complete(coro)


# ---------------------------------------------------------------------------
# Fake D1 that enforces id + scope-column matching
# ---------------------------------------------------------------------------

class _Stmt:
    def __init__(self, sql, db):
        self.sql = sql
        self.db = db
        self.binds = []

    def bind(self, *args):
        self.binds = list(args)
        return self

    async def first(self):
        sql, b = self.sql, self.binds
        if "SELECT email FROM users WHERE id" in sql:
            u = self.db.users.get(b[0])
            return {"email": u} if u else None
        m = re.search(r"FROM (\w+)", sql)
        table = m.group(1) if m else None
        rows = self.db.tables.get(table, {})
        row = rows.get(b[0]) if b else None
        if row is None:
            return None
        # Enforce the scope predicate present in the query.
        if "AND wedding_id = ?" in sql and row.get("wedding_id") != b[1]:
            return None
        if "AND user_id = ?" in sql and row.get("user_id") != b[1]:
            return None
        return dict(row)

    async def run(self):
        return None


class TenantFakeDB:
    def __init__(self):
        self.tables: dict[str, dict] = {}
        self.users: dict[str, str] = {}

    def add(self, table, _id, **cols):
        self.tables.setdefault(table, {})[_id] = {"id": _id, **cols}

    def prepare(self, sql):
        return _Stmt(sql, self)


def _req(db, auth_header=None):
    req = types.SimpleNamespace()
    req.scope = {"env": types.SimpleNamespace(DB=db)}
    req.headers = types.SimpleNamespace(get=lambda k, d=None: auth_header if k == "Authorization" else d)
    req.client = types.SimpleNamespace(host="1.2.3.4")
    return req


WED_A = {"id": "wA", "plan": "premium"}


# ---------------------------------------------------------------------------
# By-id cross-tenant access → 404
# ---------------------------------------------------------------------------

def test_events_cross_tenant_update_404():
    db = TenantFakeDB()
    db.add("events", "eB", wedding_id="wB")  # belongs to wedding B
    with pytest.raises(HTTPException) as exc:
        run(update_event("eB", EventBody(name="x"), wedding=WED_A, request=_req(db)))
    assert exc.value.status_code == 404


def test_images_cross_tenant_delete_404():
    db = TenantFakeDB()
    db.add("images", "iB", wedding_id="wB")
    with pytest.raises(HTTPException) as exc:
        run(delete_image("iB", wedding=WED_A, request=_req(db)))
    assert exc.value.status_code == 404


def test_moodboards_cross_user_get_404():
    db = TenantFakeDB()
    db.add("moodboards", "mB", user_id="userB")
    with pytest.raises(HTTPException) as exc:
        run(get_moodboard("mB", wedding=WED_A, payload={"sub": "userA"}, request=_req(db)))
    assert exc.value.status_code == 404


def test_seating_assign_foreign_guest_404():
    db = TenantFakeDB()
    db.add("seating_tables", "tA", wedding_id="wA")   # A's own table
    db.add("guests", "gB", wedding_id="wB")           # but guest belongs to B
    with pytest.raises(HTTPException) as exc:
        run(assign_seat("tA", AssignBody(guest_id="gB"), wedding=WED_A, request=_req(db)))
    assert exc.value.status_code == 404


def test_messages_foreign_guest_404():
    db = TenantFakeDB()
    db.add("guests", "gB", wedding_id="wB")
    with pytest.raises(HTTPException) as exc:
        run(create_message(MessageBody(content="hi", guest_id="gB"), wedding=WED_A, request=_req(db)))
    assert exc.value.status_code == 404


def test_guest_photo_upload_foreign_guest_404():
    db = TenantFakeDB()
    db.add("guests", "gB", wedding_id="wB")
    # Admin token for wedding A trying to attribute a photo to wedding B's guest.
    # Patch the name captured by the route module at import time.
    _gpr.decode_token = lambda t: {"wedding_id": "wA", "sub": "userA"}
    req = _req(db, auth_header="Bearer tok")
    with pytest.raises(HTTPException) as exc:
        run(upload_photo(PhotoBody(file_url="http://x", guest_id="gB"), req))
    assert exc.value.status_code == 404


# ---------------------------------------------------------------------------
# Platform-only endpoints reject a normal couple (403)
# ---------------------------------------------------------------------------
# require_platform_admin is the single gate behind GET/PUT /api/users,
# GET /api/analytics/security, and the global CMS writes (create/update/delete
# content) — so testing it covers all three.

def test_platform_admin_rejects_normal_couple():
    db = TenantFakeDB()
    db.users["uc"] = "couple@example.com"  # not in ADMIN_EMAILS
    with pytest.raises(HTTPException) as exc:
        run(require_platform_admin(payload={"sub": "uc"}, request=_req(db)))
    assert exc.value.status_code == 403


def test_platform_admin_allows_admin_email():
    db = TenantFakeDB()
    db.users["ua"] = "boss@example.com"  # in ADMIN_EMAILS
    out = run(require_platform_admin(payload={"sub": "ua"}, request=_req(db)))
    assert out == {"sub": "ua"}
