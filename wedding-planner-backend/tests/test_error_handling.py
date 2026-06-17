"""Consolidated error-envelope guards (Phase 1 #6).

Every error response is ``{"code","detail"}``. A forced unhandled exception on a
throwaway route must yield a GENERIC 500 — never a traceback, exception class,
or the secret string the route raised with.
"""
import os
import sys

os.environ.setdefault("JWT_SECRET_KEY", "test-secret")

_SRC = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "src"))
if _SRC not in sys.path:
    sys.path.insert(0, _SRC)

from fastapi import FastAPI, HTTPException  # noqa: E402
from fastapi.testclient import TestClient  # noqa: E402

from errors import register_exception_handlers  # noqa: E402

SECRET = "super-secret-internal-value-9f3a"


def _client():
    app = FastAPI()
    register_exception_handlers(app)

    @app.get("/boom")
    async def boom():
        raise ValueError(f"explode with {SECRET}")

    @app.get("/str-detail")
    async def str_detail():
        raise HTTPException(403, "You need the premium plan")

    @app.get("/dict-detail")
    async def dict_detail():
        raise HTTPException(429, {"code": "rate_limited", "error": "Slow down please"})

    # raise_server_exceptions=False so the 500 is returned as a response, not re-raised.
    return TestClient(app, raise_server_exceptions=False)


def test_unhandled_exception_returns_generic_500_without_traceback():
    resp = _client().get("/boom")
    assert resp.status_code == 500
    body = resp.json()
    assert body == {"code": "internal_error", "detail": "Internal server error"}

    raw = resp.text
    assert SECRET not in raw            # the raised message never leaks
    assert "Traceback" not in raw       # no stack trace
    assert "ValueError" not in raw      # no exception class name


def test_string_detail_httpexception_becomes_code_detail():
    resp = _client().get("/str-detail")
    assert resp.status_code == 403
    assert resp.json() == {"code": "forbidden", "detail": "You need the premium plan"}


def test_dict_detail_httpexception_collapses_to_code_detail():
    resp = _client().get("/dict-detail")
    assert resp.status_code == 429
    # The {"code","error"} dict raised by public routes collapses to {"code","detail"}.
    assert resp.json() == {"code": "rate_limited", "detail": "Slow down please"}
