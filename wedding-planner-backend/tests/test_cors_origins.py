"""CORS allow-list is read per request, not at import time."""
from fastapi.testclient import TestClient

from tests.mounted_app import FakeD1, with_env

CUSTOM = "https://rsvp.custom-domain.example"


def _acao(world, origin, method="get"):
    r = getattr(world.client, method)("/api/health", headers={"Origin": origin})
    return r.headers.get("access-control-allow-origin")


def test_extra_origin_set_after_import_is_honoured(world, monkeypatch):
    # The app module is already imported; the Worker copies settings into the
    # environment per request, i.e. later.
    monkeypatch.delenv("CORS_EXTRA_ORIGINS", raising=False)
    assert _acao(world, CUSTOM) is None
    monkeypatch.setenv("CORS_EXTRA_ORIGINS", f"https://other.example, {CUSTOM}/")
    assert _acao(world, CUSTOM) == CUSTOM
    assert _acao(world, "https://other.example") == "https://other.example"
    assert _acao(world, "https://evil.example") is None


def test_frontend_url_origin_is_added_automatically(world, monkeypatch):
    monkeypatch.setenv("FRONTEND_URL", "https://app.mywedding.example/some/path?x=1")
    assert _acao(world, "https://app.mywedding.example") == "https://app.mywedding.example"
    assert _acao(world, "https://app.mywedding.example.evil.com") is None


def test_preflight_uses_dynamic_list(world, monkeypatch):
    monkeypatch.setenv("CORS_EXTRA_ORIGINS", CUSTOM)
    r = world.client.options("/api/guests", headers={
        "Origin": CUSTOM, "Access-Control-Request-Method": "POST",
        "Access-Control-Request-Headers": "authorization"})
    assert r.status_code == 200
    assert r.headers["access-control-allow-origin"] == CUSTOM
    assert r.headers["access-control-allow-credentials"] == "true"
    r = world.client.options("/api/guests", headers={
        "Origin": "https://evil.example", "Access-Control-Request-Method": "POST"})
    assert r.status_code == 400  # starlette rejects a disallowed preflight


def test_defaults_still_allowed_and_result_is_cached(world, monkeypatch):
    monkeypatch.delenv("CORS_EXTRA_ORIGINS", raising=False)
    monkeypatch.delenv("FRONTEND_URL", raising=False)
    assert _acao(world, "http://localhost:5173") == "http://localhost:5173"
    import sys
    cfg = sys.modules["cors_config"]
    assert cfg.allowed_origins() is cfg.allowed_origins()   # same cached object


def test_worker_level_helper_matches():
    import importlib, os, sys
    # cors_config has no Workers dependencies and can be used standalone.
    os.environ["CORS_EXTRA_ORIGINS"] = CUSTOM
    try:
        cfg = importlib.import_module("cors_config")
        assert cfg.is_allowed_origin(CUSTOM) and not cfg.is_allowed_origin("")
    finally:
        os.environ.pop("CORS_EXTRA_ORIGINS", None)
