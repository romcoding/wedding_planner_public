import os
import uuid
from fastapi import Request, HTTPException, Depends
from auth import require_couple_auth
from db import row_to_dict, rows_to_list


def _admin_emails() -> set[str]:
    """Parse ADMIN_EMAILS into a normalized set.

    Single source list with two distinct, explicit uses:
      - authorization: ``require_platform_admin`` (who may touch platform data)
      - plan override:  ``_effective_plan`` (who gets full entitlements)
    """
    raw = os.environ.get("ADMIN_EMAILS", "")
    return {e.strip().lower() for e in raw.split(",") if e.strip()}


def _effective_plan(wedding: dict, user_email: str | None = None) -> str:
    """Resolve the effective plan. Delegates to entitlements (single source).

    Kept as a thin wrapper because ``get_wedding`` calls it; the lazy import
    avoids a circular import (entitlements imports ``get_wedding`` from here).
    """
    from entitlements import get_plan
    return get_plan(wedding, user_email)


async def get_db(request: Request):
    """Dependency: return D1 database binding from Cloudflare Workers env."""
    return request.scope["env"].DB


async def get_env(request: Request):
    """Dependency: return the full CF Workers env object."""
    return request.scope["env"]


async def require_platform_admin(
    payload: dict = Depends(require_couple_auth),
    request: Request = None,
) -> dict:
    """Dependency: require a real platform administrator.

    Resolves the authenticated (non-guest) user and checks their email against
    the env-configured ``ADMIN_EMAILS`` allow-list. This is AUTHORIZATION for
    platform-wide resources (all users, global CMS, security log); it is the
    same source list that ``_effective_plan`` uses for plan override, but a
    distinct, explicit use. 403 for everyone else.
    """
    db = await get_db(request)
    user_id = payload.get("sub")
    raw = await db.prepare("SELECT email FROM users WHERE id = ?").bind(user_id).first()
    user = row_to_dict(raw)
    email = (user or {}).get("email", "")
    if not email or email.lower() not in _admin_emails():
        raise HTTPException(403, "Platform administrator access required")
    return payload


async def _finalize_wedding(db, wedding_dict: dict, user_id: str) -> dict:
    """Attach the effective plan + admin-override flag to a resolved wedding row."""
    user_row = await db.prepare("SELECT email FROM users WHERE id = ?").bind(user_id).first()
    email = ((row_to_dict(user_row) or {})).get("email")
    wedding_dict["plan"] = _effective_plan(wedding_dict, email)
    wedding_dict["is_admin_override"] = bool(email and email.lower() in _admin_emails())
    return wedding_dict


async def get_wedding(
    payload: dict = Depends(require_couple_auth),
    request: Request = None,
) -> dict:
    """
    Tenant dependency — resolve the active wedding for the authenticated user.
    Extracts wedding_id from the JWT payload; falls back to DB lookup.
    Returns the wedding row as a dict (with effective plan + is_admin_override).
    """
    db = await get_db(request)
    user_id = payload.get("sub")

    wedding_id = payload.get("wedding_id")
    if wedding_id:
        wedding_raw = await db.prepare(
            "SELECT * FROM weddings WHERE id = ? AND is_active = 1"
        ).bind(wedding_id).first()
        if wedding_raw:
            return await _finalize_wedding(db, row_to_dict(wedding_raw), user_id)

    # Fallback: look up by current_wedding_id
    user_raw = await db.prepare(
        "SELECT current_wedding_id FROM users WHERE id = ?"
    ).bind(user_id).first()
    user = row_to_dict(user_raw)

    if user and user.get("current_wedding_id"):
        wedding_raw = await db.prepare(
            "SELECT * FROM weddings WHERE id = ? AND is_active = 1"
        ).bind(user.get("current_wedding_id")).first()
        if wedding_raw:
            return await _finalize_wedding(db, row_to_dict(wedding_raw), user_id)

    # Final fallback: first owned wedding
    wedding_raw = await db.prepare(
        "SELECT * FROM weddings WHERE owner_id = ? AND is_active = 1 LIMIT 1"
    ).bind(user_id).first()
    if wedding_raw:
        return await _finalize_wedding(db, row_to_dict(wedding_raw), user_id)

    # Distinct, non-403 signal: the caller is authenticated but simply has no
    # wedding yet (dead current_wedding_id AND no owned wedding). 409
    # (precondition/conflict) is what the frontend keys on to route into
    # onboarding — never confused with a real 403 entitlement block. NOT 404
    # (that collides with resource-not-found handling).
    raise HTTPException(409, detail={
        "code": "no_wedding",
        "error": "No wedding found. Please complete onboarding.",
    })


# ---------------------------------------------------------------------------
# Onboarding recovery — resolve-or-create (NEVER used by normal data routes)
# ---------------------------------------------------------------------------

async def _unique_wedding_slug(db, base: str) -> str:
    """Return *base*, suffixed with ``-N`` until it is unique in weddings.slug."""
    slug, counter = base, 1
    while True:
        existing = await db.prepare(
            "SELECT id FROM weddings WHERE slug = ?"
        ).bind(slug).first()
        if not existing:
            return slug
        slug = f"{base}-{counter}"
        counter += 1


async def _create_default_wedding(db, user_id: str) -> dict:
    """Create a fresh free+active wedding owned by *user_id* and point the user's
    ``current_wedding_id`` at it. The recovery path for an account with no
    resolvable wedding (the whole point of quick-setup).
    """
    wedding_id = str(uuid.uuid4())
    slug = await _unique_wedding_slug(db, f"wedding-{wedding_id[:8]}")
    await db.prepare(
        "INSERT INTO weddings (id, slug, owner_id, plan, is_active, created_at, updated_at) "
        "VALUES (?, ?, ?, 'free', 1, datetime('now'), datetime('now'))"
    ).bind(wedding_id, slug, user_id).run()
    await db.prepare(
        "UPDATE users SET current_wedding_id = ?, updated_at = datetime('now') WHERE id = ?"
    ).bind(wedding_id, user_id).run()
    created = row_to_dict(
        await db.prepare("SELECT * FROM weddings WHERE id = ?").bind(wedding_id).first()
    )
    if created is None:  # None-guard the post-insert select
        raise HTTPException(500, "Failed to create wedding during onboarding")
    return created


async def resolve_or_create_wedding(db, user_id: str) -> dict:
    """Resolve the caller's wedding, CREATING one if none exists.

    Order: a *valid* ``users.current_wedding_id`` -> the first active owned
    wedding -> create a new one. A dangling ``current_wedding_id`` (points to a
    missing wedding) is treated as "no wedding" and the stale pointer is
    overwritten, self-healing orphaned accounts. Returns the raw wedding row
    (without the plan/admin-override decoration ``get_wedding`` adds).
    """
    user = row_to_dict(
        await db.prepare(
            "SELECT current_wedding_id FROM users WHERE id = ?"
        ).bind(user_id).first()
    )
    current_id = (user or {}).get("current_wedding_id")

    if current_id:
        wedding = row_to_dict(
            await db.prepare(
                "SELECT * FROM weddings WHERE id = ? AND is_active = 1"
            ).bind(current_id).first()
        )
        if wedding:
            return wedding
        # Dangling pointer — fall through to owned/create and overwrite it.

    owned = row_to_dict(
        await db.prepare(
            "SELECT * FROM weddings WHERE owner_id = ? AND is_active = 1 ORDER BY created_at LIMIT 1"
        ).bind(user_id).first()
    )
    if owned:
        if current_id != owned["id"]:
            await db.prepare(
                "UPDATE users SET current_wedding_id = ?, updated_at = datetime('now') WHERE id = ?"
            ).bind(owned["id"], user_id).run()
        return owned

    return await _create_default_wedding(db, user_id)


async def get_or_create_wedding(
    payload: dict = Depends(require_couple_auth),
    request: Request = None,
) -> dict:
    """Recovery tenant dependency — like ``get_wedding`` but CREATES a wedding
    when the account has none (and self-heals a dangling pointer).

    Used ONLY by the onboarding/quick-setup flow so recovery can never deadlock.
    Normal data routes keep the strict ``get_wedding`` (which 409s) and must
    never auto-create a wedding.
    """
    db = await get_db(request)
    user_id = payload.get("sub")
    wedding = await resolve_or_create_wedding(db, user_id)
    return await _finalize_wedding(db, wedding, user_id)
