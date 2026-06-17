"""Consolidated error responses.

One place that turns every error into the same JSON envelope::

    {"code": "<machine_slug>", "detail": "<human message>"}

Two handlers are registered on the app:

  * ``HTTPException``  → normalize to the envelope. ``detail`` may have been raised
    as a plain string (most routes) or as a ``{"code","error"}`` dict (public
    routes); both collapse to ``{"code","detail"}`` so clients read one shape.
  * ``Exception``      → a generic 500. The body is ALWAYS generic: an unhandled
    error never leaks a traceback, exception message, or internal detail to the
    client. The full error is logged server-side (Workers log) for debugging.

RequestValidationError keeps FastAPI's own 422 handler (more specific than the
generic ``Exception`` handler), so request-validation feedback is unchanged.
"""
from __future__ import annotations

import logging

from fastapi.responses import JSONResponse
from starlette.exceptions import HTTPException as StarletteHTTPException

logger = logging.getLogger(__name__)

# Machine-readable code for a bare-status error (when none was supplied).
_STATUS_CODES = {
    400: "bad_request",
    401: "unauthorized",
    402: "payment_required",
    403: "forbidden",
    404: "not_found",
    405: "method_not_allowed",
    409: "conflict",
    422: "unprocessable",
    429: "rate_limited",
    500: "internal_error",
    502: "bad_gateway",
    503: "unavailable",
}


def _envelope(code: str, detail: str) -> dict:
    return {"code": code, "detail": detail}


def _normalize(status: int, detail) -> dict:
    """Collapse an HTTPException detail (str | dict | other) into the envelope."""
    fallback_code = _STATUS_CODES.get(status, f"http_{status}")
    if isinstance(detail, dict):
        code = detail.get("code") or fallback_code
        message = (
            detail.get("detail")
            or detail.get("error")
            or detail.get("message")
            or fallback_code.replace("_", " ")
        )
        return _envelope(code, message)
    if isinstance(detail, str) and detail:
        return _envelope(fallback_code, detail)
    return _envelope(fallback_code, fallback_code.replace("_", " "))


async def http_exception_handler(request, exc: StarletteHTTPException) -> JSONResponse:
    return JSONResponse(
        status_code=exc.status_code,
        content=_normalize(exc.status_code, exc.detail),
        headers=getattr(exc, "headers", None),
    )


async def unhandled_exception_handler(request, exc: Exception) -> JSONResponse:
    # Log the real error server-side (type + path; no request body / PII), but
    # NEVER return it. The client only ever sees the generic envelope.
    path = getattr(getattr(request, "url", None), "path", "?")
    logger.error("[error] unhandled %s on %s", type(exc).__name__, path, exc_info=True)
    return JSONResponse(
        status_code=500,
        content=_envelope("internal_error", "Internal server error"),
    )


def register_exception_handlers(app) -> None:
    """Attach the consolidated handlers to a FastAPI/Starlette app."""
    app.add_exception_handler(StarletteHTTPException, http_exception_handler)
    app.add_exception_handler(Exception, unhandled_exception_handler)
