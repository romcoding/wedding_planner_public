"""Public-RSVP CORS guards (Phase 2).

The rendered couple site POSTs its RSVP form cross-origin to
/api/public/rsvp/{slug} from a site origin that is NOT in the credentialed
allow-list. That one endpoint (and its preflight) must answer with
Access-Control-Allow-Origin:* and NO credentials — while every authenticated
route keeps the strict, per-origin, credentialed allow-list untouched.

The app here mirrors main.py's middleware stack: the strict CORSMiddleware with
PublicRsvpCORSMiddleware installed OUTSIDE it.
"""
import os
import sys

os.environ.setdefault("JWT_SECRET_KEY", "test-secret")

_SRC = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "src"))
if _SRC not in sys.path:
    sys.path.insert(0, _SRC)

from fastapi import FastAPI  # noqa: E402
from fastapi.middleware.cors import CORSMiddleware  # noqa: E402
from fastapi.testclient import TestClient  # noqa: E402

from public_cors import PublicRsvpCORSMiddleware  # noqa: E402

ALLOWED = "http://localhost:5173"          # an allow-listed credentialed origin
SITE_ORIGIN = "https://couple.example.com"  # a couple-site origin, NOT allow-listed


def _client():
    app = FastAPI()
    app.add_middleware(
        CORSMiddleware,
        allow_origins=[ALLOWED],
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )
    app.add_middleware(PublicRsvpCORSMiddleware)  # outside CORSMiddleware

    @app.post("/api/public/rsvp/{slug}")
    async def rsvp(slug: str):
        return {"ok": True}

    @app.post("/api/website/content")
    async def credentialed():
        return {"ok": True}

    return TestClient(app)


def test_public_rsvp_preflight_is_permissive_and_uncredentialed():
    r = _client().options(
        "/api/public/rsvp/alex-sam",
        headers={
            "Origin": SITE_ORIGIN,
            "Access-Control-Request-Method": "POST",
            "Access-Control-Request-Headers": "content-type",
        },
    )
    assert r.status_code in (200, 204)
    assert r.headers.get("access-control-allow-origin") == "*"
    assert "access-control-allow-credentials" not in r.headers       # never credentialed
    assert "POST" in (r.headers.get("access-control-allow-methods") or "")


def test_public_rsvp_post_response_is_permissive_and_uncredentialed():
    r = _client().post("/api/public/rsvp/alex-sam",
                       headers={"Origin": SITE_ORIGIN}, json={})
    assert r.status_code == 200
    assert r.headers.get("access-control-allow-origin") == "*"
    assert "access-control-allow-credentials" not in r.headers


def test_credentialed_route_preflight_is_per_origin_not_wildcard():
    r = _client().options(
        "/api/website/content",
        headers={"Origin": ALLOWED, "Access-Control-Request-Method": "POST"},
    )
    aco = r.headers.get("access-control-allow-origin")
    assert aco == ALLOWED and aco != "*"                              # reflected, not "*"
    assert r.headers.get("access-control-allow-credentials") == "true"


def test_credentialed_route_does_not_leak_wildcard_to_unlisted_origin():
    r = _client().options(
        "/api/website/content",
        headers={"Origin": SITE_ORIGIN, "Access-Control-Request-Method": "POST"},
    )
    # A non-allow-listed origin on a credentialed route is never answered with "*".
    assert r.headers.get("access-control-allow-origin") != "*"
