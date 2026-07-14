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
import logging
import re

from fastapi import APIRouter, Request, Depends, HTTPException, Query
from pydantic import BaseModel

from middleware import get_db, get_env
from entitlements import require_feature, get_plan
from db import row_to_dict, rows_to_list
from obs import log_event
from services import site_schema, rate_limit, usage, wedi_site, ai_service
from services.site_cache import purge_site_cache
# Reuse the SAME PBKDF2 hashing as user auth (passlib pbkdf2_sha256) for the
# optional guest password — never roll a second password scheme.
from routes.auth_routes import _hash_password

logger = logging.getLogger(__name__)

router = APIRouter()

# All website routes share this gate (require_feature -> get_wedding chain).
_gate = require_feature("website_builder")

# Wedi generation is a distinct entitlement (premium/lifetime only) so a free
# website-builder user (there is none today) could never reach the model path.
_wedi_gate = require_feature("wedi_site_generation")

# Slugs that can never be claimed (collide with product/app routes). 's' is the
# public-site path prefix (/s/{slug}); 'w' is the guest portal (/w/:slug).
RESERVED_SLUGS = {
    "api", "www", "admin", "app", "auth", "wedi", "billing", "w", "s", "static",
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
    expected_version: int | None = None


class SettingsBody(BaseModel):
    theme: str | None = None
    slug: str | None = None
    rsvp_enabled: bool | None = None
    # Optional guest password: a non-empty string sets it, "" clears it,
    # None leaves it unchanged.
    password: str | None = None


class GenerateBody(BaseModel):
    prompt: str = ""
    mode: str = "full"  # 'full' (whole site) | 'refine' (targeted block edits)


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
    published_snapshot = site.get("published_snapshot")
    return {
        "id": site.get("id"),
        "slug": site.get("slug"),
        "custom_host": site.get("custom_host"),
        "theme": site.get("theme") or site_schema.DEFAULT_THEME,
        "status": site.get("status") or "draft",
        "rsvp_enabled": bool(site.get("rsvp_enabled", 1)),
        "has_password": bool(site.get("password_hash")),
        "content": _parse_doc(site.get("draft_content")),
        "content_version": site.get("content_version") or 1,
        # Derived, not stored: does the draft differ from what's actually live?
        # Compared as parsed dicts (not raw JSON text) so incidental
        # key-ordering never produces a false positive.
        "has_unpublished_changes": bool(published_snapshot) and (
            _parse_doc(site.get("draft_content")) != _parse_doc(published_snapshot)
        ),
        "published_at": site.get("published_at"),
        "created_at": site.get("created_at"),
        "updated_at": site.get("updated_at"),
        # Path of the live public site (served at PUBLIC_SITE_BASE_URL + this).
        "public_path": f"/s/{site.get('slug')}",
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
    """Validate + save the draft content document.

    Optimistic concurrency: if the caller supplies ``expected_version``, it
    must match the row's current ``content_version`` or the write is rejected
    with 409. This guards against a silent last-write-wins clobber when the
    same site is open in two tabs/devices — the client-side save queue
    (useWebsite.js) only serializes requests within a single tab.
    """
    db = await get_db(request)
    site = await _get_or_create_site(db, wedding)
    try:
        doc = site_schema.validate_document(body.content)
    except site_schema.ValidationError as exc:
        raise HTTPException(400, {"code": "content_invalid", "error": str(exc)})

    current_version = site.get("content_version") or 1
    if body.expected_version is not None and body.expected_version != current_version:
        raise HTTPException(409, {
            "code": "version_conflict",
            "error": "This site was edited elsewhere — reload to see the latest changes.",
            "current_version": current_version,
        })

    await db.prepare(
        "UPDATE wedding_sites SET draft_content = ?, content_version = ?, updated_at = datetime('now') "
        "WHERE id = ?"
    ).bind(json.dumps(doc), current_version + 1, site["id"]).run()
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
    next_version = (site.get("content_version") or 1) + 1

    await db.prepare(
        "UPDATE wedding_sites SET draft_content = ?, published_snapshot = ?, content_version = ?, "
        "status = 'published', published_at = datetime('now'), updated_at = datetime('now') "
        "WHERE id = ?"
    ).bind(snapshot, snapshot, next_version, site["id"]).run()

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
    next_version = (site.get("content_version") or 1) + 1
    await db.prepare(
        "UPDATE wedding_sites SET draft_content = ?, content_version = ?, updated_at = datetime('now') "
        "WHERE id = ?"
    ).bind(rev["snapshot"], next_version, site["id"]).run()
    raw = await db.prepare("SELECT * FROM wedding_sites WHERE id = ?").bind(site["id"]).first()
    return _site_dict(row_to_dict(raw))


# ---------------------------------------------------------------------------
# Wedi generation ("Wedi designs your website")
# ---------------------------------------------------------------------------

_WEDI_FAILED_DETAIL = {
    "code": "wedi_failed",
    "detail": "Wedi couldn't finish this draft just now — please try again.",
}


async def _wedding_context(db, wedding: dict) -> dict:
    """Assemble the SAFE generation context for a wedding.

    Includes ONLY partner names, the date, the location/venue, and agenda
    highlights (titles/times/locations). It must NEVER include guest rows or
    emails, costs, or messages — those never leave the database for generation.
    """
    ctx = {
        "partner_one": (wedding.get("partner_one_name") or "").strip(),
        "partner_two": (wedding.get("partner_two_name") or "").strip(),
        "wedding_date": (wedding.get("wedding_date") or "").strip(),
        "location": (wedding.get("location") or "").strip(),
        "agenda_highlights": [],
    }
    try:
        result = await db.prepare(
            'SELECT title, start_time, location FROM agenda_items '
            'WHERE wedding_id = ? ORDER BY "order", start_time LIMIT 8'
        ).bind(wedding["id"]).all()
        for item in rows_to_list(result):
            title = (item.get("title") or "").strip()
            if title:
                ctx["agenda_highlights"].append({
                    "title": title,
                    "time": (item.get("start_time") or "").strip(),
                    "location": (item.get("location") or "").strip(),
                })
    except Exception:  # agenda is best-effort context; never block generation on it
        ctx["agenda_highlights"] = []
    return ctx


@router.post("/generate")
async def generate(
    body: GenerateBody,
    wedding: dict = Depends(_wedi_gate),
    request: Request = None,
):
    """Let Wedi draft (mode='full') or refine (mode='refine') the site.

    Strict order of operations: kill switch -> per-minute velocity -> monthly
    budget -> model call -> validate/merge -> save to DRAFT (never auto-publish)
    -> record usage from actual token counts.
    """
    env = await get_env(request)
    db = await get_db(request)
    wedding_id = wedding["id"]
    plan = get_plan(wedding)

    # 1. Kill switch — before any work, so a paused feature costs nothing.
    if usage.generation_disabled(env):
        log_event("wedi_generation", wedding_id=wedding_id, status="paused")
        raise HTTPException(503, {
            "code": "wedi_paused",
            "detail": "Wedi is taking a short break — please try again soon.",
        })

    prompt = (body.prompt or "").strip()
    if len(prompt) > 1500:
        raise HTTPException(400, {
            "code": "prompt_too_long",
            "detail": "Please shorten your note to Wedi a little.",
        })
    mode = "refine" if body.mode == "refine" else "full"

    # 2. Per-minute velocity (KV-backed; fails open if unconfigured).
    if not await usage.within_velocity(env, wedding_id):
        log_event("wedi_generation", wedding_id=wedding_id, status="rate_limited", mode=mode)
        raise HTTPException(429, {
            "code": "slow_down",
            "detail": "Wedi is still working — give it a moment.",
        })

    # 3. Monthly budget — BEFORE the model call, so an over-limit account makes
    #    zero model requests.
    try:
        await usage.check_budget(db, wedding_id, plan)
    except usage.BudgetExceeded as exc:
        await usage.log_generation(db, wedding_id, ai_service.DEFAULT_MODEL, "over_limit", purpose=mode)
        log_event("wedi_generation", wedding_id=wedding_id, status="over_limit", mode=mode)
        raise HTTPException(429, {
            "code": "wedi_limit",
            "detail": f"Wedi has reached this month's design limit. It resets on {exc.resets_on}.",
        })

    site = await _get_or_create_site(db, wedding)
    current_content = _parse_doc(site.get("draft_content"))
    wedding_context = await _wedding_context(db, wedding)

    # 4 + 5. Model call, then validate/merge (one retry lives inside the service).
    try:
        result = await wedi_site.generate_site_content(
            env, wedding_context, prompt, current_content, mode
        )
    except (wedi_site.GenerationError, RuntimeError) as exc:
        logger.warning(f"wedi generation failed for wedding {wedding_id}: {exc}")
        await usage.log_generation(db, wedding_id, ai_service.DEFAULT_MODEL, "error", purpose=mode)
        log_event("wedi_generation", wedding_id=wedding_id, status="error", mode=mode)
        raise HTTPException(502, _WEDI_FAILED_DETAIL)

    doc = result["content"]

    # 6. Save to the DRAFT only — Wedi never publishes on the couple's behalf.
    next_version = (site.get("content_version") or 1) + 1
    await db.prepare(
        "UPDATE wedding_sites SET draft_content = ?, content_version = ?, updated_at = datetime('now') "
        "WHERE id = ?"
    ).bind(json.dumps(doc), next_version, site["id"]).run()

    # 7. Record usage from the model's ACTUAL token counts (+ an 'ok' audit row).
    await usage.record_usage(db, wedding_id, result["model"], result["usage"], purpose=mode)

    # Structured ops log — ids + counts + status only, NEVER the prompt or PII.
    _u = result.get("usage") or {}
    log_event("wedi_generation", wedding_id=wedding_id, status="ok", mode=mode,
              input_tokens=_u.get("input_tokens"), output_tokens=_u.get("output_tokens"))

    status = await usage.get_status(db, wedding_id, plan)
    # content_version is returned so the client's save-queue version tracking
    # (useWebsite.js) stays in sync — otherwise the next autosave after a
    # Wedi draft would spuriously 409 with a stale expected_version.
    return {"content": doc, "content_version": next_version, "remaining_generations": status["remaining"]}


@router.get("/generation-status")
async def generation_status(
    wedding: dict = Depends(_wedi_gate),
    request: Request = None,
):
    """Wedi's monthly usage for the quiet footer indicator and client gating."""
    db = await get_db(request)
    status = await usage.get_status(db, wedding["id"], get_plan(wedding))
    return {"used": status["used"], "limit": status["limit"], "resetsOn": status["resetsOn"]}


# ---------------------------------------------------------------------------
# Public-site RSVP inbox (responses from the open /s/{slug} form)
# ---------------------------------------------------------------------------

def _rsvp_dict(r: dict) -> dict:
    """Tenant-safe shape of a public RSVP response (never leaks wedding_id)."""
    return {
        "id": r.get("id"),
        "guest_name": r.get("guest_name"),
        "email": r.get("email"),
        "attending": bool(r.get("attending")),
        "party_size": r.get("party_size") or 1,
        "dietary": r.get("dietary"),
        "message": r.get("message"),
        "matched": bool(r.get("matched_guest_id")),
        "created_at": r.get("created_at"),
    }


@router.get("/rsvps")
async def list_rsvps(
    wedding: dict = Depends(_gate),
    request: Request = None,
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
):
    """Paginated public-website RSVP responses for THIS wedding (tenant-scoped)."""
    db = await get_db(request)
    wid = wedding["id"]
    total_row = await db.prepare(
        "SELECT COUNT(*) AS n FROM site_rsvp_responses WHERE wedding_id = ?"
    ).bind(wid).first()
    total = (row_to_dict(total_row) or {}).get("n", 0)
    result = await db.prepare(
        "SELECT * FROM site_rsvp_responses WHERE wedding_id = ? "
        "ORDER BY id DESC LIMIT ? OFFSET ?"
    ).bind(wid, limit, offset).all()
    return {
        "responses": [_rsvp_dict(r) for r in rows_to_list(result)],
        "total": total,
        "limit": limit,
        "offset": offset,
    }


@router.post("/rsvps/{response_id}/add-guest")
async def add_rsvp_to_guests(
    response_id: int,
    wedding: dict = Depends(_gate),
    request: Request = None,
):
    """Create a guest from an unmatched RSVP response (reuses the guest schema).

    Tenant-scoped: the response must belong to THIS wedding. Idempotent-ish — if
    the response is already matched, returns the existing match without creating
    a duplicate.
    """
    import secrets
    import uuid

    db = await get_db(request)
    wid = wedding["id"]
    raw = await db.prepare(
        "SELECT * FROM site_rsvp_responses WHERE id = ? AND wedding_id = ?"
    ).bind(response_id, wid).first()
    resp = row_to_dict(raw)
    if not resp:
        raise HTTPException(404, {"code": "not_found", "error": "Response not found"})
    if resp.get("matched_guest_id"):
        return {"created": False, "guest_id": resp["matched_guest_id"],
                "rsvp": _rsvp_dict(resp)}

    name = (resp.get("guest_name") or "").strip()
    parts = name.split()
    first = parts[0] if parts else "Guest"
    last = " ".join(parts[1:]) if len(parts) > 1 else ""
    attending = bool(resp.get("attending"))

    guest_id = str(uuid.uuid4())
    token = secrets.token_urlsafe(32)
    await db.prepare(
        "INSERT INTO guests (id, wedding_id, first_name, last_name, email, unique_token, "
        "rsvp_status, number_of_guests, dietary_restrictions, registered_at, updated_at) "
        "VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))"
    ).bind(
        guest_id, wid, first, last, (resp.get("email") or ""), token,
        "attending" if attending else "declined",
        resp.get("party_size") or 1, resp.get("dietary") or None,
    ).run()

    # Link the response to the new guest so it no longer shows as unmatched.
    await db.prepare(
        "UPDATE site_rsvp_responses SET matched_guest_id = ? WHERE id = ? AND wedding_id = ?"
    ).bind(guest_id, response_id, wid).run()
    resp["matched_guest_id"] = guest_id
    return {"created": True, "guest_id": guest_id, "rsvp": _rsvp_dict(resp)}
