"""Tests against the REAL mounted ``main.app`` (paths, prefixes, auth, error
envelope) — so mount-prefix bugs like a router included without its prefix are
caught, which direct handler calls cannot see."""
import pytest
from fastapi.testclient import TestClient

from tests.mounted_app import FakeD1, with_env


def test_every_route_lives_under_api_or_public_site(real_app):
    """A router mounted without its prefix shows up as a bare path here.

    (FastAPI >= 0.12x nests included routers, so ``app.routes`` is not flat —
    the OpenAPI document is the reliable flattened view of what is mounted.)
    """
    allowed = ("/api/", "/s/")
    bad = [p for p in real_app.openapi()["paths"] if not p.startswith(allowed)]
    assert bad == []


def test_health_and_unknown_route_use_envelope(real_app):
    db = FakeD1()
    c = TestClient(with_env(real_app, db))
    assert c.get("/api/health").json()["status"] == "ok"
    r = c.get("/api/nope")
    assert r.status_code == 404
    assert set(r.json()) == {"code", "detail"}


def test_auth_required_envelope(real_app):
    c = TestClient(with_env(real_app, FakeD1()))
    r = c.get("/api/analytics/overview")
    assert r.status_code == 401
    assert r.json() == {"code": "unauthorized", "detail": "Authorization token is missing"}
