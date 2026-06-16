"""Public wedding-site hosting tests (P4).

Covers the server renderer's escaping, the /s/{slug} route (published / 404 /
password gate / signed cookie), the open RSVP endpoint (tenant-derived
wedding_id, honeypot, rate limit, angle-bracket rejection), cache-purge wiring on
every lifecycle action, RSVP-inbox tenant isolation, and a static guard that the
public route file only touches the allowed tables.

Like test_website.py, the fake D1 is a real in-memory SQLite loaded from
schema.sql, and handlers are called directly — no Workers runtime needed.
"""
import os
import re
import sys
import json
import time
import hmac
import types
import hashlib
import asyncio
import sqlite3
from urllib.parse import unquote

import pytest

# ---------------------------------------------------------------------------
# Environment + Pyodide/runtime stubs (must precede the imports under test)
# ---------------------------------------------------------------------------
os.environ.setdefault("JWT_SECRET_KEY", "test-secret")
os.environ["ADMIN_EMAILS"] = "boss@example.com"
os.environ["STRIPE_WEBHOOK_SECRET"] = "whsec_test"
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

# Ensure a stubbed `services` package (installed by other test modules) can still
# resolve the real submodules used here.
_services_pkg = sys.modules.get("services")
if _services_pkg is not None and not hasattr(_services_pkg, "__path__"):
    _services_pkg.__path__ = [os.path.abspath(os.path.join(_SRC, "services"))]

from fastapi import HTTPException  # noqa: E402
from services import site_schema  # noqa: E402
from routes import website_routes as wr  # noqa: E402
from routes import public_site_routes as ps  # noqa: E402
from routes import billing_routes  # noqa: E402

_SCHEMA = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "schema.sql"))
_PUBLIC_ROUTE_FILE = os.path.join(_SRC, "routes", "public_site_routes.py")


def run(coro):
    return asyncio.get_event_loop().run_until_complete(coro)


# ---------------------------------------------------------------------------
# SQLite-backed fake D1 + fake KV
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

    def count(self, sql, *args):
        return self.conn.execute(sql, args).fetchone()[0]


class FakeKV:
    """Minimal KV with the get/put surface rate_limit.check uses."""
    def __init__(self):
        self.store = {}

    async def get(self, key):
        return self.store.get(key)

    async def put(self, key, value, options=None):
        self.store[key] = value


def _req(db, *, headers=None, body=b"", kv=None):
    req = types.SimpleNamespace()
    hdrs = {k.lower(): v for k, v in (headers or {}).items()}
    req.headers = types.SimpleNamespace(get=lambda k, d=None: hdrs.get(k.lower(), d))
    env = types.SimpleNamespace(DB=db)
    if kv is not None:
        env.RATE_LIMIT = kv
    req.scope = {"env": env}

    async def _body():
        return body
    req.body = _body
    return req


def _wedding(wid="wA", slug="alex-sam", plan="premium"):
    return {
        "id": wid, "plan": plan, "slug": slug,
        "partner_one_name": "Alex", "partner_two_name": "Sam",
        "wedding_date": "2099-09-12", "location": "Lake Como",
    }


def _seed_published(db, *, wedding=None, story_body=None, password=None,
                    rsvp_enabled=True):
    """Create a site via the editor API, optionally tweak it, and publish."""
    wedding = wedding or _wedding()
    run(wr.get_site(wedding=wedding, request=_req(db)))
    if story_body is not None or not rsvp_enabled:
        doc = site_schema.default_document(wedding)
        if story_body is not None:
            for b in doc["blocks"]:
                if b["type"] == "story":
                    b["enabled"] = True
                    b["data"]["body"] = story_body
        run(wr.update_content(wr.ContentBody(content=doc), wedding=wedding, request=_req(db)))
    settings = {}
    if password is not None:
        settings["password"] = password
    if not rsvp_enabled:
        settings["rsvp_enabled"] = False
    if settings:
        run(wr.update_settings(wr.SettingsBody(**settings), wedding=wedding, request=_req(db)))
    run(wr.publish(wedding=wedding, request=_req(db)))
    return db.one("SELECT * FROM wedding_sites WHERE wedding_id = ?", wedding["id"])


def _set_cookie_value(resp, site_id):
    raw = resp.headers.get("set-cookie") or ""
    marker = f"site_access_{site_id}="
    if marker not in raw:
        return None
    return unquote(raw.split(marker, 1)[1].split(";", 1)[0])


# ---------------------------------------------------------------------------
# Rendering + escaping
# ---------------------------------------------------------------------------

def test_published_site_renders_200_and_escapes_injected_script():
    db = FakeD1()
    # Inject a <script> directly via the editor path (validator keeps the text);
    # the renderer is the boundary that must neutralize it.
    _seed_published(db, story_body="<script>alert('xss')</script>")
    resp = run(ps.serve_site(slug="alex-sam", request=_req(db)))
    assert resp.status_code == 200
    assert resp.headers.get("cache-control") == "public, max-age=300"
    body = resp.body.decode()
    assert "<script>alert('xss')</script>" not in body          # not executable
    assert "&lt;script&gt;alert(" in body                        # rendered as text
    assert "Made with Wedi" in body and "AI" not in "Made with Wedi"
    assert "/api/public/rsvp/alex-sam" in body                   # rsvp form endpoint
    assert 'og:url" content="https://api.example.dev/s/alex-sam' in body


def test_draft_unpublished_and_unknown_slug_return_friendly_404():
    db = FakeD1()
    # draft (never published)
    run(wr.get_site(wedding=_wedding("wD", "draft-site"), request=_req(db)))
    r = run(ps.serve_site(slug="draft-site", request=_req(db)))
    assert r.status_code == 404 and b"AI" not in r.body and b"Traceback" not in r.body
    assert r.headers.get("cache-control") == "no-store"
    # unpublished
    _seed_published(db, wedding=_wedding("wU", "gone-site"))
    run(wr.unpublish(wedding=_wedding("wU", "gone-site"), request=_req(db)))
    assert run(ps.serve_site(slug="gone-site", request=_req(db))).status_code == 404
    # unknown
    assert run(ps.serve_site(slug="no-such-slug", request=_req(db))).status_code == 404


# ---------------------------------------------------------------------------
# Password gate + signed cookie
# ---------------------------------------------------------------------------

def test_password_flow_form_wrong_correct_and_tampered_cookie():
    db = FakeD1()
    site = _seed_published(db, password="hunter2pass")
    sid = site["id"]

    # no cookie -> password form (200, never cached)
    r = run(ps.serve_site(slug="alex-sam", request=_req(db)))
    assert r.status_code == 200 and r.headers.get("cache-control") == "no-store"
    assert b"password" in r.body and b"This website is private" in r.body

    # wrong password -> 401 + form
    r = run(ps.submit_password(slug="alex-sam", request=_req(db, body=b"password=nope")))
    assert r.status_code == 401 and b"password" in r.body

    # correct password -> 200 render + Set-Cookie
    r = run(ps.submit_password(slug="alex-sam", request=_req(db, body=b"password=hunter2pass")))
    assert r.status_code == 200
    cookie = _set_cookie_value(r, sid)
    assert cookie and b"Made with Wedi" in r.body

    # valid cookie on GET -> renders (still no-store)
    r = run(ps.serve_site(slug="alex-sam", request=_req(db, headers={"cookie": f"site_access_{sid}={cookie}"})))
    assert r.status_code == 200 and r.headers.get("cache-control") == "no-store"
    assert b"This website is private" not in r.body

    # tampered cookie -> back to the form
    r = run(ps.serve_site(slug="alex-sam", request=_req(db, headers={"cookie": f"site_access_{sid}={cookie}x"})))
    assert r.status_code == 200 and b"password" in r.body


# ---------------------------------------------------------------------------
# Public RSVP endpoint
# ---------------------------------------------------------------------------

def test_rsvp_happy_path_uses_site_wedding_id_and_matches_guest():
    db = FakeD1()
    _seed_published(db)
    db.exec("INSERT INTO guests (id, wedding_id, first_name, last_name, email, unique_token) "
            "VALUES ('g1', 'wA', 'Jordan', 'Lee', 'j@x.com', 'tok1')")
    body = ps.RsvpBody(guest_name="jordan lee", email="j@x.com", attending=True,
                       party_size=4, dietary="vegan", message="cannot wait")
    # A spoofed wedding_id in the payload must be impossible — RsvpBody has no such
    # field, so tenancy can only come from the slug. Confirm the stored row.
    resp = run(ps.submit_rsvp(slug="alex-sam", body=body, request=_req(db, kv=FakeKV())))
    assert resp.status_code == 200 and b"see you there" in resp.body
    row = db.one("SELECT * FROM site_rsvp_responses WHERE guest_name = 'jordan lee'")
    assert row["wedding_id"] == "wA"               # from the SITE, never the body
    assert row["party_size"] == 4 and row["attending"] == 1
    assert row["matched_guest_id"] == "g1"         # case-insensitive name match


def test_rsvp_honeypot_silently_dropped():
    db = FakeD1()
    _seed_published(db)
    body = ps.RsvpBody(guest_name="Spammy", website="http://spam.example", attending=True)
    resp = run(ps.submit_rsvp(slug="alex-sam", body=body, request=_req(db, kv=FakeKV())))
    assert resp.status_code == 200                                  # looks successful
    assert db.count("SELECT COUNT(*) FROM site_rsvp_responses WHERE guest_name='Spammy'") == 0


def test_rsvp_rate_limited_after_five_per_window():
    db = FakeD1()
    _seed_published(db)
    kv = FakeKV()  # shared across calls so the window counter persists
    ok = 0
    limited = 0
    for i in range(6):
        try:
            run(ps.submit_rsvp(slug="alex-sam", body=ps.RsvpBody(guest_name=f"Guest {i}"),
                               request=_req(db, headers={"CF-Connecting-IP": "9.9.9.9"}, kv=kv)))
            ok += 1
        except HTTPException as exc:
            assert exc.status_code == 429
            limited += 1
    assert ok == 5 and limited == 1


def test_rsvp_rejects_angle_brackets_in_message():
    db = FakeD1()
    _seed_published(db)
    with pytest.raises(HTTPException) as exc:
        run(ps.submit_rsvp(slug="alex-sam", body=ps.RsvpBody(guest_name="ok", message="<b>hi</b>"),
                           request=_req(db, kv=FakeKV())))
    assert exc.value.status_code == 400


def test_rsvp_blocked_when_rsvp_disabled():
    db = FakeD1()
    _seed_published(db, rsvp_enabled=False)
    with pytest.raises(HTTPException) as exc:
        run(ps.submit_rsvp(slug="alex-sam", body=ps.RsvpBody(guest_name="ok"),
                           request=_req(db, kv=FakeKV())))
    assert exc.value.status_code == 403


# ---------------------------------------------------------------------------
# Cache purge wired into every lifecycle action
# ---------------------------------------------------------------------------

def test_cache_purge_invoked_on_publish_unpublish_settings_and_downgrade(monkeypatch):
    db = FakeD1()
    calls = []

    async def spy(slug):
        calls.append(slug)

    monkeypatch.setattr(wr, "purge_site_cache", spy)
    monkeypatch.setattr(billing_routes, "purge_site_cache", spy)

    W = _wedding()
    run(wr.get_site(wedding=W, request=_req(db)))

    run(wr.publish(wedding=W, request=_req(db)))
    assert calls[-1] == "alex-sam"                              # publish purges

    run(wr.update_settings(wr.SettingsBody(slug="alex-and-sam"), wedding=W, request=_req(db)))
    assert "alex-and-sam" in calls and "alex-sam" in calls       # slug change purges both

    run(wr.unpublish(wedding=W, request=_req(db)))
    assert calls[-1] == "alex-and-sam"                          # unpublish purges

    # Downgrade hook (billing) purges the site's slug after unpublishing it.
    db.exec("UPDATE weddings SET plan='premium', stripe_subscription_id='sub_x' WHERE id='wA'")
    db.exec("UPDATE wedding_sites SET status='published' WHERE wedding_id='wA'")
    calls.clear()
    run(billing_routes._unpublish_sites(db, "wA"))
    assert calls == ["alex-and-sam"]


# ---------------------------------------------------------------------------
# Cross-tenant isolation of the RSVP inbox
# ---------------------------------------------------------------------------

def test_rsvp_inbox_is_tenant_scoped():
    db = FakeD1()
    _seed_published(db, wedding=_wedding("wA", "alex-sam"))
    _seed_published(db, wedding=_wedding("wB", "bob-kim"))
    # A response lands on wedding A's site.
    run(ps.submit_rsvp(slug="alex-sam", body=ps.RsvpBody(guest_name="Guest A"),
                       request=_req(db, kv=FakeKV())))
    a_inbox = run(wr.list_rsvps(wedding=_wedding("wA", "alex-sam"), request=_req(db),
                                limit=50, offset=0))
    b_inbox = run(wr.list_rsvps(wedding=_wedding("wB", "bob-kim"), request=_req(db),
                                limit=50, offset=0))
    assert a_inbox["total"] == 1 and a_inbox["responses"][0]["guest_name"] == "Guest A"
    assert b_inbox["total"] == 0                                # B can never read A's rows
    # And B cannot add A's response to B's guest list.
    a_id = a_inbox["responses"][0]["id"]
    with pytest.raises(HTTPException) as exc:
        run(wr.add_rsvp_to_guests(a_id, wedding=_wedding("wB", "bob-kim"), request=_req(db)))
    assert exc.value.status_code == 404


# ---------------------------------------------------------------------------
# Static guard: the public route file only touches the allowed tables
# ---------------------------------------------------------------------------

def test_public_route_file_references_only_allowed_tables():
    with open(_PUBLIC_ROUTE_FILE) as fh:
        source = fh.read()
    tables = set(re.findall(r"(?:FROM|INTO|UPDATE)\s+([a-z_]+)", source))
    assert tables <= {"wedding_sites", "site_rsvp_responses", "guests"}, tables
