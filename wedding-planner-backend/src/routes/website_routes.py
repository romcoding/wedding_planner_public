"""Wedding-website builder routes.

The website is a STRUCTURED-CONTENT system: couples edit a JSON document of
typed blocks (validated by services/site_schema.py — the authoritative
boundary); themes render those blocks. No user- or model-authored HTML is ever
stored or rendered.

TENANT + ENTITLEMENT: every route below is gated by
``require_feature("website_builder")``, which chains
``require_couple_auth -> get_wedding -> feature check``. The active wedding (and
therefore ``wedding_id``) is ALWAYS the one resolved by ``get_wedding`` — it is
NEVER read from a request body. A free account hits 403 ``upgrade_required``.

There are two distinct RSVP channels in this codebase; do not conflate them:
  * guest-token RSVP (existing, guest_routes): one row per invited guest,
    authenticated by guests.unique_token, updates guests.rsvp_status.
  * public website RSVP (new, site_rsvp_responses): an OPEN form on the public
    site, no token, best-effort fuzzy-matched. (The public submit endpoint and
    renderer land with the P4 public-hosting phase.)
"""
import json
import re

from fastapi import APIRouter, Request, Depends, HTTPException, Query
from pydantic import BaseModel

from middleware import get_db, get_env
from entitlements import require_feature
from db import row_to_dict, rows_to_list
from services import site_schema, rate_limit
from services.site_cache import purge_site_cache
# Reuse the SAME PBKDF2 hashing as user auth (passlib pbkdf2_sha256) for the
# optional guest password — never roll a second password scheme.
from routes.auth_routes import _hash_password

router = APIRouter()

# All website routes share this gate (require_feature -> get_wedding chain).
_gate = require_feature("website_builder")

# Slugs that can never be claimed (collide with product/app routes).
RESERVED_SLUGS = {
    "api", "www", "admin", "app", "auth", "wedi", "billing", "w", "static",
    "assets", "login", "register", "help", "mail", "blog", "demo", "venue",
    "venues",
}

_SLUG_RE = re.compile(r"^[a-z0-9-]+$")
SLUG_MIN, SLUG_MAX = 3, 40


# ---------------------------------------------------------------------------
# Pydantic bodies (note: NONE of these carry wedding_id — tenancy is server-side)
# ---------------------------------------------------------------------------

class ContentBody(BaseModel):
    content: dict


class SettingsBody(BaseModel):
    theme: str | None = None
    slug: str | None = None
    rsvp_enabled: bool | None = None
    # Optional guest password: a non-empty string sets it, "" clears it,
    # None leaves it unchanged.
    password: str | None = None


# ---------------------------------------------------------------------------
# Slug helpers
# ---------------------------------------------------------------------------

def _normalize_slug(raw: str | None) -> str:
    s = (raw or "").strip().lower()
    s = re.sub(r"[^a-z0-9-]+", "-", s)
    s = re.sub(r"-+", "-", s).strip("-")
    return s


def _slug_error(slug: str) -> str | None:
    """Return a human-readable reason the slug is invalid, or None if it's OK."""
    if len(slug) < SLUG_MIN:
        return f"Address must be at least {SLUG_MIN} characters"
    if len(slug) > SLUG_MAX:
        return f"Address must be at most {SLUG_MAX} characters"
    if not _SLUG_RE.match(slug):
        return "Use only lowercase letters, numbers and hyphens"
    if slug in RESERVED_SLUGS:
        return "That address is reserved"
    return None


async def _slug_taken(db, slug: str, exclude_wedding_id: str) -> bool:
    raw = await db.prepare(
        "SELECT wedding_id FROM wedding_sites WHERE slug = ? AND wedding_id != ?"
    ).bind(slug, exclude_wedding_id).first()
    return row_to_dict(raw) is not None


async def _unique_site_slug(db, base: str, wedding_id: str) -> str:
    """Normalize *base* to a valid, globally-unique, non-reserved site slug."""
    base = _normalize_slug(base) or "our-wedding"
    if len(base) < SLUG_MIN:
        base = (base + "-wedding")[:SLUG_MAX]
    base = base[:SLUG_MAX]
    candidate, n = base, 1
    while _slug_error(candidate) or await _slug_taken(db, candidate, wedding_id):
        suffix = f"-{n}"
        candidate = (base[: SLUG_MAX - len(suffix)] + suffix)
        n += 1
        if n > 9999:  # pathological — fall back to something guaranteed unique
            candidate = f"site-{str(wedding_id)[:8]}"
            break
    return candidate


# ---------------------------------------------------------------------------
# Site row helpers
# ---------------------------------------------------------------------------

def _parse_doc(raw) -> dict:
    try:
        doc = json.loads(raw or "{}")
    except (TypeError, ValueError):
        return {}
    return doc if isinstance(doc, dict) else {}


def _site_dict(site: dict) -> dict:
    """Public-facing shape of a site row. NEVER exposes password_hash."""
    return {
        "id": site.get("id"),
        "slug": site.get("slug"),
        "custom_host": site.get("custom_host"),
        "theme": site.get("theme") or site_schema.DEFAULT_THEME,
        "status": site.get("status") or "draft",
        "rsvp_enabled": bool(site.get("rsvp_enabled", 1)),
        "has_password": bool(site.get("password_hash")),
        "content": _parse_doc(site.get("draft_content")),
        "published_at": site.get("published_at"),
        "created_at": site.get("created_at"),
        "updated_at": site.get("updated_at"),
        # Where the published site will live once P4 ships (display only here).
        "public_path": f"/w/{site.get('slug')}",
    }


async def _get_or_create_site(db, wedding: dict) -> dict:
    """Return the wedding's site row, lazily creating it (seeded) on first access."""
    wid = wedding["id"]
    raw = await db.prepare(
        "SELECT * FROM wedding_sites WHERE wedding_id = ?"
    ).bind(wid).first()
    site = row_to_dict(raw)
    if site:
        return site

    base = wedding.get("slug") or wedding.get("partner_one_name") or "our-wedding"
    slug = await _unique_site_slug(db, base, wid)
    doc = site_schema.default_document(wedding)
    # INSERT OR IGNORE protects against a create race (wedding_id is UNIQUE).
    await db.prepare(
        "INSERT OR IGNORE INTO wedding_sites "
        "(wedding_id, slug, theme, status, draft_content, rsvp_enabled, created_at, updated_at) "
        "VALUES (?, ?, 'classic', 'draft', ?, 1, datetime('now'), datetime('now'))"
    ).bind(wid, slug, json.dumps(doc)).run()
    raw = await db.prepare(
        "SELECT * FROM wedding_sites WHERE wedding_id = ?"
    ).bind(wid).first()
    return row_to_dict(raw)


# ---------------------------------------------------------------------------
# Routes
# ---------------------------------------------------------------------------

@router.get("")
async def get_site(wedding: dict = Depends(_gate), request: Request = None):
    """Return the wedding's site, creating it with seeded defaults on first access."""
    db = await get_db(request)
    site = await _get_or_create_site(db, wedding)
    return _site_dict(site)


@router.put("/content")
async def update_content(
    body: ContentBody,
    wedding: dict = Depends(_gate),
    request: Request = None,
):
    """Validate + save the draft content document."""
    db = await get_db(request)
    site = await _get_or_create_site(db, wedding)
    try:
        doc = site_schema.validate_document(body.content)
    except site_schema.ValidationError as exc:
        raise HTTPException(400, {"code": "content_invalid", "error": str(exc)})
    await db.prepare(
        "UPDATE wedding_sites SET draft_content = ?, updated_at = datetime('now') WHERE id = ?"
    ).bind(json.dumps(doc), site["id"]).run()
    raw = await db.prepare("SELECT * FROM wedding_sites WHERE id = ?").bind(site["id"]).first()
    return _site_dict(row_to_dict(raw))


@router.put("/settings")
async def update_settings(
    body: SettingsBody,
    wedding: dict = Depends(_gate),
    request: Request = None,
):
    """Update theme, slug, rsvp_enabled and the optional guest password."""
    db = await get_db(request)
    site = await _get_or_create_site(db, wedding)

    updates: list[str] = []
    binds: list = []

    if body.theme is not None:
        if body.theme not in site_schema.VALID_THEMES:
            raise HTTPException(400, {"code": "invalid_theme", "error": "Unknown theme"})
        updates.append("theme = ?"); binds.append(body.theme)

    new_slug = None
    if body.slug is not None:
        new_slug = _normalize_slug(body.slug)
        err = _slug_error(new_slug)
        if err:
            raise HTTPException(400, {"code": "invalid_slug", "error": err})
        if new_slug != site["slug"]:
            if await _slug_taken(db, new_slug, wedding["id"]):
                raise HTTPException(409, {"code": "slug_taken", "error": "That address is already taken"})
            updates.append("slug = ?"); binds.append(new_slug)

    if body.rsvp_enabled is not None:
        updates.append("rsvp_enabled = ?"); binds.append(int(body.rsvp_enabled))

    if body.password is not None:
        if body.password == "":
            updates.append("password_hash = ?"); binds.append(None)  # clear
        else:
            updates.append("password_hash = ?"); binds.append(_hash_password(body.password))

    if updates:
        updates.append("updated_at = datetime('now')")
        binds.append(site["id"])
        await db.prepare(
            f"UPDATE wedding_sites SET {', '.join(updates)} WHERE id = ?"
        ).bind(*binds).run()

    # Changing the slug while published re-points the live site to the SAME
    # published_snapshot (the snapshot lives on the row, so it travels with the
    # slug). Purge both addresses so the edge serves the new one.
    if new_slug and new_slug != site["slug"] and site.get("status") == "published":
        await purge_site_cache(site["slug"])
        await purge_site_cache(new_slug)

    raw = await db.prepare("SELECT * FROM wedding_sites WHERE id = ?").bind(site["id"]).first()
    return _site_dict(row_to_dict(raw))


@router.get("/slug-check")
async def slug_check(
    slug: str = Query(...),
    wedding: dict = Depends(_gate),
    request: Request = None,
):
    """Check slug availability. Rate-limited to 30/min per account."""
    env = await get_env(request)
    if not await rate_limit.check(env, f"slug_check:{wedding['id']}", 30, 60):
        raise HTTPException(429, {"code": "rate_limited", "error": "Too many checks — please slow down"})

    normalized = _normalize_slug(slug)
    err = _slug_error(normalized)
    if err:
        return {"slug": normalized, "available": False, "reason": err}
    db = await get_db(request)
    taken = await _slug_taken(db, normalized, wedding["id"])
    return {
        "slug": normalized,
        "available": not taken,
        "reason": "That address is already taken" if taken else None,
    }


@router.post("/publish")
async def publish(wedding: dict = Depends(_gate), request: Request = None):
    """Freeze the draft into published_snapshot, snapshot a revision, go live."""
    db = await get_db(request)
    site = await _get_or_create_site(db, wedding)

    # Re-validate the draft before freezing (the validator is authoritative).
    try:
        doc = site_schema.validate_document(_parse_doc(site.get("draft_content")))
    except site_schema.ValidationError as exc:
        raise HTTPException(400, {"code": "content_invalid", "error": str(exc)})
    snapshot = json.dumps(doc)

    await db.prepare(
        "UPDATE wedding_sites SET draft_content = ?, published_snapshot = ?, "
        "status = 'published', published_at = datetime('now'), updated_at = datetime('now') "
        "WHERE id = ?"
    ).bind(snapshot, snapshot, site["id"]).run()

    # One revision per publish, pruned to the 10 most recent (monotonic id order).
    await db.prepare(
        "INSERT INTO site_revisions (site_id, snapshot, created_at) VALUES (?, ?, datetime('now'))"
    ).bind(site["id"], snapshot).run()
    await db.prepare(
        "DELETE FROM site_revisions WHERE site_id = ? AND id NOT IN "
        "(SELECT id FROM site_revisions WHERE site_id = ? ORDER BY id DESC LIMIT 10)"
    ).bind(site["id"], site["id"]).run()

    await purge_site_cache(site["slug"])

    raw = await db.prepare("SELECT * FROM wedding_sites WHERE id = ?").bind(site["id"]).first()
    return _site_dict(row_to_dict(raw))


@router.post("/unpublish")
async def unpublish(wedding: dict = Depends(_gate), request: Request = None):
    """Take the site offline (status='unpublished'). Draft + snapshot are kept."""
    db = await get_db(request)
    site = await _get_or_create_site(db, wedding)
    await db.prepare(
        "UPDATE wedding_sites SET status = 'unpublished', updated_at = datetime('now') WHERE id = ?"
    ).bind(site["id"]).run()
    await purge_site_cache(site["slug"])
    raw = await db.prepare("SELECT * FROM wedding_sites WHERE id = ?").bind(site["id"]).first()
    return _site_dict(row_to_dict(raw))


@router.get("/revisions")
async def list_revisions(wedding: dict = Depends(_gate), request: Request = None):
    """List this site's published-snapshot revisions, newest first."""
    db = await get_db(request)
    site = await _get_or_create_site(db, wedding)
    result = await db.prepare(
        "SELECT id, created_at FROM site_revisions WHERE site_id = ? ORDER BY id DESC"
    ).bind(site["id"]).all()
    return rows_to_list(result)


@router.post("/revisions/{revision_id}/restore")
async def restore_revision(
    revision_id: int,
    wedding: dict = Depends(_gate),
    request: Request = None,
):
    """Restore a revision's snapshot into the draft (verifies tenant ownership)."""
    db = await get_db(request)
    site = await _get_or_create_site(db, wedding)

    # Cross-tenant safety: the revision must belong to THIS wedding's site.
    rev = await db.prepare(
        "SELECT sr.snapshot FROM site_revisions sr "
        "JOIN wedding_sites ws ON ws.id = sr.site_id "
        "WHERE sr.id = ? AND ws.wedding_id = ?"
    ).bind(revision_id, wedding["id"]).first()
    rev = row_to_dict(rev)
    if not rev:
        raise HTTPException(404, {"code": "not_found", "error": "Revision not found"})

    # The snapshot was validated at publish time; copy it back to the draft.
    await db.prepare(
        "UPDATE wedding_sites SET draft_content = ?, updated_at = datetime('now') WHERE id = ?"
    ).bind(rev["snapshot"], site["id"]).run()
    raw = await db.prepare("SELECT * FROM wedding_sites WHERE id = ?").bind(site["id"]).first()
    return _site_dict(row_to_dict(raw))
