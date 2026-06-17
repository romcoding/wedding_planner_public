"""End-to-end lifecycle, chained through the REAL handlers (Phase 3 #8).

The runtime-independent slice of the go-live matrix: build a site -> publish ->
a logged-out guest loads /s/{slug} and RSVPs -> the response shows in the inbox
-> "Add to guest list" creates a guest -> a downgrade unpublishes -> /s/{slug}
404s. Stripe checkout, real email, the browser and the edge cache are covered in
MANUAL-QA.md instead.

Like test_public_site.py, the fake D1 is a real in-memory SQLite loaded from
schema.sql and the handlers are called directly — no Workers runtime.
"""
import os
import sys
import json
import types
import asyncio
import sqlite3

os.environ.setdefault("JWT_SECRET_KEY", "test-secret")
os.environ["PUBLIC_SITE_BASE_URL"] = "https://api.example.dev"

for _n in ("workers", "asgi", "js"):
    sys.modules.setdefault(_n, types.ModuleType(_n))

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

_services_pkg = sys.modules.get("services")
if _services_pkg is not None and not hasattr(_services_pkg, "__path__"):
    _services_pkg.__path__ = [os.path.join(_SRC, "services")]

from services import site_schema  # noqa: E402
from routes import website_routes as wr  # noqa: E402
from routes import public_site_routes as ps  # noqa: E402

_SCHEMA = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "schema.sql"))


def run(coro):
    return asyncio.get_event_loop().run_until_complete(coro)


# --- fake D1 / KV / request (same shape as test_public_site.py) -------------

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


class FakeKV:
    def __init__(self):
        self.store = {}

    async def get(self, key):
        return self.store.get(key)

    async def put(self, key, value, options=None):
        self.store[key] = value


def _req(db, *, headers=None, kv=None):
    req = types.SimpleNamespace()
    hdrs = {k.lower(): v for k, v in (headers or {}).items()}
    req.headers = types.SimpleNamespace(get=lambda k, d=None: hdrs.get(k.lower(), d))
    env = types.SimpleNamespace(DB=db)
    if kv is not None:
        env.RATE_LIMIT = kv
    req.scope = {"env": env}

    async def _body():
        return b""
    req.body = _body
    return req


def _wedding(wid="wA", slug="alex-sam", plan="premium"):
    return {"id": wid, "plan": plan, "slug": slug,
            "partner_one_name": "Alex", "partner_two_name": "Sam",
            "wedding_date": "2099-09-12", "location": "Lake Como"}


def test_full_site_lifecycle_build_publish_rsvp_inbox_addguest_downgrade():
    db = FakeD1()
    wedding = _wedding()

    # 1. Build: create the site, set content, publish.
    run(wr.get_site(wedding=wedding, request=_req(db)))
    doc = site_schema.default_document(wedding)
    run(wr.update_content(wr.ContentBody(content=doc), wedding=wedding, request=_req(db)))
    pub = run(wr.publish(wedding=wedding, request=_req(db)))
    assert pub.get("status") == "published"

    # 2. A logged-out guest loads /s/{slug} -> 200 published HTML.
    page = run(ps.serve_site(slug="alex-sam", request=_req(db)))
    assert page.status_code == 200
    assert b"/api/public/rsvp/alex-sam" in page.body          # the RSVP form posts here

    # 3. The guest RSVPs through the open form (name does NOT match any guest).
    body = ps.RsvpBody(guest_name="Robin Vega", email="robin@example.com",
                       attending=True, party_size=2, dietary="none", message="yay")
    rsvp = run(ps.submit_rsvp(slug="alex-sam", body=body, request=_req(db, kv=FakeKV())))
    assert rsvp.status_code == 200
    row = db.one("SELECT * FROM site_rsvp_responses WHERE guest_name='Robin Vega'")
    assert row["wedding_id"] == "wA" and row["matched_guest_id"] is None   # unmatched

    # 4. It shows in the tenant-scoped inbox.
    inbox = run(wr.list_rsvps(wedding=wedding, request=_req(db), limit=50, offset=0))
    assert inbox["total"] == 1
    resp = inbox["responses"][0]
    assert resp["guest_name"] == "Robin Vega"

    # 5. "Add to guest list" creates a guest and links the response.
    added = run(wr.add_rsvp_to_guests(response_id=resp["id"], wedding=wedding, request=_req(db)))
    assert added["created"] is True
    guest = db.one("SELECT first_name, last_name, rsvp_status FROM guests WHERE wedding_id='wA'")
    assert (guest["first_name"], guest["last_name"]) == ("Robin", "Vega")
    assert db.one("SELECT matched_guest_id FROM site_rsvp_responses WHERE id=?",
                  resp["id"])["matched_guest_id"] is not None

    # 6. Downgrade/unpublish -> the public URL 404s (snapshot retained for republish).
    run(wr.unpublish(wedding=wedding, request=_req(db)))
    gone = run(ps.serve_site(slug="alex-sam", request=_req(db)))
    assert gone.status_code == 404
    assert b"Traceback" not in gone.body and b"AI" not in gone.body


def test_republish_restores_site_from_snapshot():
    db = FakeD1()
    wedding = _wedding(wid="wR", slug="rosa-kim")
    run(wr.get_site(wedding=wedding, request=_req(db)))
    run(wr.update_content(wr.ContentBody(content=site_schema.default_document(wedding)),
                          wedding=wedding, request=_req(db)))
    run(wr.publish(wedding=wedding, request=_req(db)))
    run(wr.unpublish(wedding=wedding, request=_req(db)))
    assert run(ps.serve_site(slug="rosa-kim", request=_req(db))).status_code == 404

    # One-click republish restores the published snapshot.
    re = run(wr.publish(wedding=wedding, request=_req(db)))
    assert re.get("status") == "published"
    assert run(ps.serve_site(slug="rosa-kim", request=_req(db))).status_code == 200
