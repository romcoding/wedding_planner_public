"""Allowed CORS origins, resolved per request.

On Workers the settings (``CORS_EXTRA_ORIGINS``, ``FRONTEND_URL``) are copied
into ``os.environ`` at the start of every request, i.e. AFTER this module has
been imported — so they cannot be read at import time. ``allowed_origins()``
reads them on each call and caches the result keyed on the raw setting values:
after the first request it is a cheap tuple comparison, and it self-heals if a
setting changes.
"""
import os
from urllib.parse import urlparse

from starlette.middleware.cors import CORSMiddleware

BASE_ORIGINS = (
    "https://wedding-planner-frontend.romanhess1994.workers.dev",
    "http://localhost:5173",
    "http://localhost:3000",
    "http://localhost:8000",
)

_cache: tuple[tuple[str, str], frozenset[str]] | None = None


def _origin_of(url: str) -> str | None:
    """'https://app.example.com/path' -> 'https://app.example.com' (None if not a URL)."""
    try:
        p = urlparse((url or "").strip())
    except ValueError:
        return None
    if p.scheme not in ("http", "https") or not p.netloc:
        return None
    return f"{p.scheme}://{p.netloc}"


def allowed_origins() -> frozenset[str]:
    global _cache
    key = (os.environ.get("CORS_EXTRA_ORIGINS", ""), os.environ.get("FRONTEND_URL", ""))
    if _cache is not None and _cache[0] == key:
        return _cache[1]
    origins = set(BASE_ORIGINS)
    origins.update(o.strip().rstrip("/") for o in key[0].split(",") if o.strip())
    frontend = _origin_of(key[1])
    if frontend:
        origins.add(frontend)
    result = frozenset(origins)
    _cache = (key, result)
    return result


def is_allowed_origin(origin: str) -> bool:
    return bool(origin) and origin in allowed_origins()


class DynamicCORSMiddleware(CORSMiddleware):
    """CORSMiddleware whose allow-list is resolved per request."""

    def is_allowed_origin(self, origin: str) -> bool:  # noqa: D401
        return is_allowed_origin(origin)
