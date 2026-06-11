import os
from fastapi import Request, HTTPException, Depends
from auth import require_couple_auth, decode_token


def _admin_emails() -> set[str]:
    """Parse ADMIN_EMAILS into a normalized set.

    Single source list with two distinct, explicit uses:
      - authorization: ``require_platform_admin`` (who may touch platform data)
      - plan override:  ``_effective_plan`` (who gets full entitlements)
    """
    raw = os.environ.get("ADMIN_EMAILS", "")
    return {e.strip().lower() for e in raw.split(",") if e.strip()}


PLAN_ORDER = {"free": 0, "starter": 1, "premium": 2}

PLAN_LIMITS = {
    "free": {
        "max_guests": 30,
        "max_tasks": 10,
        "ai_uses_per_day": 0,
        "custom_slug": False,
        "full_budget": False,
    },
    "starter": {
        "max_guests": 150,
        "max_tasks": None,
        "ai_uses_per_day": 3,
        "custom_slug": True,
        "full_budget": True,
    },
    "premium": {
        "max_guests": None,
        "max_tasks": None,
        "ai_uses_per_day": None,
        "custom_slug": True,
        "full_budget": True,
    },
}


def _effective_plan(wedding: dict, user_email: str | None = None) -> str:
    if user_email and user_email.lower() in _admin_emails():
        return "premium"
    return wedding.get("plan", "free")


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
    row = await db.prepare("SELECT email FROM users WHERE id = ?").bind(user_id).first()
    user = dict(row) if row else None
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


async def get_wedding(
    payload: dict = Depends(require_couple_auth),
    request: Request = None,
) -> dict:
    """
    Tenant dependency — resolve the active wedding for the authenticated user.
    Extracts wedding_id from the JWT payload; falls back to DB lookup.
    Returns the wedding row as a dict.
    """
    db = await get_db(request)

    user_id = payload.get("sub")

    wedding_id = payload.get("wedding_id")
    if wedding_id:
        wedding_raw = await db.prepare(
            "SELECT * FROM weddings WHERE id = ? AND is_active = 1"
        ).bind(wedding_id).first()
        wedding_dict = dict(wedding_raw) if wedding_raw else None
        if wedding_dict:
            user_row_raw = await db.prepare("SELECT email FROM users WHERE id = ?").bind(user_id).first()
            user_email_row = dict(user_row_raw) if user_row_raw else {}
            orig_plan = wedding_dict.get("plan", "free")
            wedding_dict["plan"] = _effective_plan(wedding_dict, user_email_row.get("email"))
            wedding_dict["is_admin_override"] = wedding_dict["plan"] != orig_plan
            return wedding_dict

    # Fallback: look up by owner_id
    user_raw = await db.prepare(
        "SELECT current_wedding_id FROM users WHERE id = ?"
    ).bind(user_id).first()
    user = dict(user_raw) if user_raw else None

    if user and user.get("current_wedding_id"):
        wedding_raw = await db.prepare(
            "SELECT * FROM weddings WHERE id = ? AND is_active = 1"
        ).bind(user.get("current_wedding_id")).first()
        wedding_dict = dict(wedding_raw) if wedding_raw else None
        if wedding_dict:
            user_row_raw = await db.prepare("SELECT email FROM users WHERE id = ?").bind(user_id).first()
            user_email_row = dict(user_row_raw) if user_row_raw else {}
            orig_plan = wedding_dict.get("plan", "free")
            wedding_dict["plan"] = _effective_plan(wedding_dict, user_email_row.get("email"))
            wedding_dict["is_admin_override"] = wedding_dict["plan"] != orig_plan
            return wedding_dict

    # Final fallback: first owned wedding
    wedding_raw = await db.prepare(
        "SELECT * FROM weddings WHERE owner_id = ? AND is_active = 1 LIMIT 1"
    ).bind(user_id).first()
    wedding_dict = dict(wedding_raw) if wedding_raw else None
    if wedding_dict:
        user_row_raw = await db.prepare("SELECT email FROM users WHERE id = ?").bind(user_id).first()
        user_email_row = dict(user_row_raw) if user_row_raw else {}
        orig_plan = wedding_dict.get("plan", "free")
        wedding_dict["plan"] = _effective_plan(wedding_dict, user_email_row.get("email"))
        wedding_dict["is_admin_override"] = wedding_dict["plan"] != orig_plan
        return wedding_dict

    raise HTTPException(403, detail={
        "error": "No wedding found. Please complete onboarding.",
        "needs_onboarding": True,
    })


def wedding_meets_plan(wedding: dict, min_plan: str) -> bool:
    my_tier = PLAN_ORDER.get(wedding.get("plan", "free"), 0)
    req_tier = PLAN_ORDER.get(min_plan, 0)
    return my_tier >= req_tier


def get_plan_limit(wedding: dict, feature: str):
    return PLAN_LIMITS.get(wedding.get("plan", "free"), {}).get(feature)


def require_plan(min_plan: str):
    """Decorator-style dependency factory for plan enforcement."""
    async def _check(wedding: dict = Depends(get_wedding)):
        if not wedding_meets_plan(wedding, min_plan):
            raise HTTPException(402, detail={
                "error": f"This feature requires the {min_plan} plan or higher.",
                "current_plan": wedding.get("plan"),
                "required_plan": min_plan,
                "upgrade_url": "/admin/billing",
            })
        return wedding
    return _check
