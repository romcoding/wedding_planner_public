"""Public wedding-site hosting — NO auth. Served by the backend worker.

Two surfaces, both unauthenticated:

  * ``GET /s/{slug}``            — the published site, server-rendered from
                                   ``wedding_sites.published_snapshot`` (never the
                                   SPA, never the draft). Optional guest password
                                   gates it behind a signed, site-scoped cookie.
  * ``POST /api/public/rsvp/{slug}`` — the open RSVP form's submit endpoint.

Tenancy is derived ENTIRELY from the slug/host lookup; ``wedding_id`` is NEVER
read from the request body. This file may read ONLY ``wedding_sites`` (lookup),
``site_rsvp_responses`` (insert) and ``guests`` (best-effort name match) — see the
grep assertion in tests/test_public_site.py.
"""
from __future__ import annotations

import hmac
import json
import logging
import os
import re
import time
from hashlib import sha256
from urllib.parse import parse_qs

from fastapi import APIRouter, Request, HTTPException
from fastapi.responses import HTMLResponse, JSONResponse, Response
from pydantic import BaseModel

from middleware import get_db, get_env
from db import row_to_dict
from services import rate_limit, site_renderer
# Reuse the SAME PBKDF2 verify as user auth for the optional guest password.
from routes.auth_routes import _check_password

logger = logging.getLogger(__name__)

router = APIRouter()

_COOKIE_TTL = 7 * 24 * 60 * 60  # 7 days
_EMAIL_RE = re.compile(r"^[^\s@]+@[^\s@]+\.[^\s@]+$")
# Hosts that are the worker's own origin, not a couple's custom domain.
_DEFAULT_HOST_HINTS = ("workers.dev", "localhost", "127.0.0.1")


# ---------------------------------------------------------------------------
# Request helpers
# ---------------------------------------------------------------------------

def _header(request, name: str, default=None):
    try:
        get = request.headers.get
    except AttributeError:
        return default
    return get(name) or get(name.lower()) or get(name.title()) or default


def _host(request) -> str:
    return (_header(request, "host", "") or "").split(":")[0].strip().lower()


def _client_ip(request) -> str:
    cf = _header(request, "CF-Connecting-IP")
    if cf:
        return cf.strip()
    xff = _header(request, "X-Forwarded-For")
    if xff:
        return xff.split(",")[0].strip()
    return "unknown"


def _base_url(request) -> str:
    """The public origin links/OG/RSVP endpoints are built from.

    PUBLIC_SITE_BASE_URL wins (so links keep working when a custom domain points
    at the worker); otherwise derive from the request Host so /s/ works on day one.
    """
    configured = os.environ.get("PUBLIC_SITE_BASE_URL")
    if configured:
        return configured.rstrip("/")
    host = _host(request)
    if host:
        scheme = "http" if host.startswith(("localhost", "127.0.0.1")) else "https"
        return f"{scheme}://{host}"
    return ""


def _get_cookie(request, name: str):
    cookies = getattr(request, "cookies", None)
    if isinstance(cookies, dict) and name in cookies:
        return cookies[name]
    header = _header(request, "cookie", "") or ""
    for part in header.split(";"):
        part = part.strip()
        if "=" in part:
            k, v = part.split("=", 1)
            if k == name:
                return v
    return None


async def _read_form(request) -> dict:
    raw = await request.body()
    if isinstance(raw, (bytes, bytearray)):
        raw = raw.decode("utf-8", "ignore")
    parsed = parse_qs(raw or "", keep_blank_values=True)
    return {k: (v[0] if v else "") for k, v in parsed.items()}


# ---------------------------------------------------------------------------
# Site-scoped signed cookie (HMAC; fail-closed). Reuses JWT_SECRET_KEY unless a
# dedicated RSVP_COOKIE_SECRET is set.
# ---------------------------------------------------------------------------

def _cookie_secret() -> str:
    return os.environ.get("RSVP_COOKIE_SECRET") or os.environ.get("JWT_SECRET_KEY") or ""


def _cookie_name(site_id) -> str:
    return f"site_access_{site_id}"


def _sign_cookie(site_id, slug: str, expiry: int) -> str:
    secret = _cookie_secret()
    msg = f"{site_id}:{slug}:{expiry}".encode()
    sig = hmac.new(secret.encode(), msg, sha256).hexdigest()
    return f"{expiry}.{sig}"


def _valid_cookie(value, site_id, slug: str) -> bool:
    if not value or not _cookie_secret():
        return False
    try:
        expiry_str, sig = value.split(".", 1)
        expiry = int(expiry_str)
    except (ValueError, AttributeError):
        return False
    if expiry < int(time.time()):
        return False
    expected = _sign_cookie(site_id, slug, expiry).split(".", 1)[1]
    return hmac.compare_digest(sig, expected)


def _set_cookie_header(resp: Response, site_id, slug: str) -> None:
    expiry = int(time.time()) + _COOKIE_TTL
    value = _sign_cookie(site_id, slug, expiry)
    resp.set_cookie(
        key=_cookie_name(site_id),
        value=value,
        max_age=_COOKIE_TTL,
        path=f"/s/{slug}",
        httponly=True,
        secure=True,
        samesite="lax",
    )


# ---------------------------------------------------------------------------
# Site resolution (custom_host first, else /s/{slug}); published only.
# ---------------------------------------------------------------------------

async def resolve_site(db, request, slug: str) -> dict | None:
    """Resolve the PUBLISHED site for this request.

    Checks the Host header against ``custom_host`` first (forward-compat for the
    wildcard-domain phase), then falls back to the ``/s/{slug}`` path lookup.
    """
    host = _host(request)
    if host and not any(h in host for h in _DEFAULT_HOST_HINTS):
        raw = await db.prepare(
            "SELECT * FROM wedding_sites WHERE custom_host = ? AND status = 'published'"
        ).bind(host).first()
        site = row_to_dict(raw)
        if site:
            return site
    raw = await db.prepare(
        "SELECT * FROM wedding_sites WHERE slug = ? AND status = 'published'"
    ).bind(slug).first()
    return row_to_dict(raw)


def _snapshot(site: dict) -> dict | None:
    try:
        doc = json.loads(site.get("published_snapshot") or "")
    except (TypeError, ValueError):
        return None
    return doc if isinstance(doc, dict) and doc.get("blocks") else None


def _html(content: str, status: int, cache: str) -> HTMLResponse:
    return HTMLResponse(content=content, status_code=status,
                        headers={"Cache-Control": cache})


def _not_found(base_url: str) -> HTMLResponse:
    return _html(site_renderer.render_not_found_page(base_url), 404, "no-store")


# ---------------------------------------------------------------------------
# GET /s/{slug} — render the published site (or password gate / 404)
# ---------------------------------------------------------------------------

@router.get("/s/{slug}")
async def serve_site(slug: str, request: Request = None):
    db = await get_db(request)
    base_url = _base_url(request)
    site = await resolve_site(db, request, slug)
    if not site:
        return _not_found(base_url)

    snapshot = _snapshot(site)
    if snapshot is None:
        return _not_found(base_url)

    real_slug = site.get("slug") or slug
    if site.get("password_hash"):
        cookie = _get_cookie(request, _cookie_name(site["id"]))
        if not _valid_cookie(cookie, site["id"], real_slug):
            # Password-protected sites are NEVER cached.
            return _html(site_renderer.render_password_page(real_slug, base_url),
                         200, "no-store")
        return _html(_render(site, snapshot, base_url), 200, "no-store")

    # Password-less published site — cacheable at the edge.
    return _html(_render(site, snapshot, base_url), 200, "public, max-age=300")


@router.post("/s/{slug}")
async def submit_password(slug: str, request: Request = None):
    """Verify the guest password; on success set a signed cookie and render."""
    db = await get_db(request)
    base_url = _base_url(request)
    site = await resolve_site(db, request, slug)
    if not site:
        return _not_found(base_url)
    real_slug = site.get("slug") or slug

    snapshot = _snapshot(site)
    if snapshot is None:
        return _not_found(base_url)

    if not site.get("password_hash"):
        # Nothing to verify — just render.
        return _html(_render(site, snapshot, base_url), 200, "public, max-age=300")

    form = await _read_form(request)
    password = form.get("password", "")
    if not _check_password(password, site["password_hash"]):
        return _html(site_renderer.render_password_page(real_slug, base_url, error=True),
                     401, "no-store")

    resp = _html(_render(site, snapshot, base_url), 200, "no-store")
    _set_cookie_header(resp, site["id"], real_slug)
    return resp


def _render(site: dict, snapshot: dict, base_url: str) -> str:
    return site_renderer.render_site(
        snapshot,
        site.get("theme") or "classic",
        site.get("slug") or "",
        base_url,
        rsvp_enabled=bool(site.get("rsvp_enabled", 1)),
    )


# ---------------------------------------------------------------------------
# POST /api/public/rsvp/{slug} — open RSVP submission
# ---------------------------------------------------------------------------

class RsvpBody(BaseModel):
    guest_name: str = ""
    email: str | None = ""
    attending: bool = True
    party_size: int = 1
    dietary: str | None = ""
    message: str | None = ""
    website: str | None = ""  # honeypot — must stay empty


def _thanks(attending: bool) -> str:
    return ("Thank you — see you there!" if attending
            else "Thank you for letting us know — you'll be missed!")


def _clean(value, *, field: str, max_len: int, required: bool = False) -> str:
    text = (value or "").strip()
    if required and not text:
        raise HTTPException(400, {"code": "invalid", "error": f"{field} is required"})
    if len(text) > max_len:
        raise HTTPException(400, {"code": "invalid", "error": f"{field} is too long"})
    # Mirror site_schema's boundary: never accept angle brackets in open input.
    if "<" in text or ">" in text:
        raise HTTPException(400, {"code": "invalid", "error": f"{field} contains invalid characters"})
    return text


async def _match_guest(db, wedding_id: str, name: str):
    """Best-effort case-insensitive match of *name* to a guest of this wedding."""
    try:
        raw = await db.prepare(
            "SELECT id FROM guests WHERE wedding_id = ? "
            "AND lower(trim(first_name || ' ' || last_name)) = lower(trim(?)) LIMIT 1"
        ).bind(wedding_id, name).first()
        matched = row_to_dict(raw)
        return matched.get("id") if matched else None
    except Exception:  # matching is best-effort; never block a submission on it
        return None


@router.post("/api/public/rsvp/{slug}")
async def submit_rsvp(slug: str, body: RsvpBody, request: Request = None):
    env = await get_env(request)
    db = await get_db(request)

    # Honeypot: a bot filled the hidden field. Look successful, store nothing.
    if (body.website or "").strip():
        return JSONResponse({"ok": True, "message": _thanks(bool(body.attending))})

    # Rate limit per IP + slug (best-effort; fails open if KV is unavailable).
    ip = _client_ip(request)
    if not await rate_limit.check(env, f"rsvp:{ip}:{slug}", 5, 600):
        raise HTTPException(429, {"code": "rate_limited",
                                  "error": "Too many submissions — please try again later."})

    site = await resolve_site(db, request, slug)
    if not site:
        raise HTTPException(404, {"code": "not_found", "error": "This website isn't available."})
    if not bool(site.get("rsvp_enabled", 1)):
        raise HTTPException(403, {"code": "rsvp_closed", "error": "RSVPs are closed for this website."})

    name = _clean(body.guest_name, field="Name", max_len=120, required=True)
    email = _clean(body.email, field="Email", max_len=200)
    if email and not _EMAIL_RE.match(email):
        raise HTTPException(400, {"code": "invalid_email", "error": "Please enter a valid email."})
    dietary = _clean(body.dietary, field="Dietary note", max_len=300)
    message = _clean(body.message, field="Message", max_len=500)
    try:
        party_size = int(body.party_size)
    except (TypeError, ValueError):
        party_size = 1
    party_size = max(1, min(10, party_size))
    attending = bool(body.attending)

    # wedding_id comes from the SITE, never the request body.
    wedding_id = site["wedding_id"]
    matched_guest_id = await _match_guest(db, wedding_id, name)

    await db.prepare(
        "INSERT INTO site_rsvp_responses "
        "(wedding_id, site_id, guest_name, email, attending, party_size, dietary, message, "
        "matched_guest_id, created_at) "
        "VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))"
    ).bind(
        wedding_id, site["id"], name, email or None, 1 if attending else 0,
        party_size, dietary or None, message or None, matched_guest_id,
    ).run()

    return JSONResponse({"ok": True, "message": _thanks(attending)})
