import os
from fastapi import Request, HTTPException, Depends
from auth import require_couple_auth, decode_token
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


async def get_current_user(request: Request, db=Depends(get_db)):
    """Validates Bearer JWT and returns decoded payload."""
    auth = request.headers.get("Authorization", "")
    if not auth.startswith("Bearer "):
        raise HTTPException(401, "Missing token")
    try:
        payload = decode_token(auth.split(" ", 1)[1])
        return payload
    except Exception:
        raise HTTPException(401, "Invalid token")


async def get_wedding_db(current_user=Depends(get_current_user)):
    """Returns the wedding_id from the current JWT."""
    return current_user["wedding_id"]


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

    raise HTTPException(403, detail={
        "error": "No wedding found. Please complete onboarding.",
        "needs_onboarding": True,
    })
