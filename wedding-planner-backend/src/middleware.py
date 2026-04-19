from fastapi import Request, HTTPException, Depends
from src.auth import require_admin_auth

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


async def get_db(request: Request):
    """Dependency: return D1 database binding from Cloudflare Workers env."""
    env = getattr(request.state, "env", None)
    if env is None:
        raise HTTPException(500, "Database binding not available")
    return env.DB


async def get_wedding(
    payload: dict = Depends(require_admin_auth),
    request: Request = None,
) -> dict:
    """
    Tenant dependency — resolve the active wedding for the authenticated user.
    Extracts wedding_id from the JWT payload; falls back to DB lookup.
    Returns the wedding row as a dict.
    """
    db = await get_db(request)

    wedding_id = payload.get("wedding_id")
    if wedding_id:
        wedding = await db.prepare(
            "SELECT * FROM weddings WHERE id = ? AND is_active = 1"
        ).bind(wedding_id).first()
        if wedding:
            return dict(wedding)

    # Fallback: look up by owner_id
    user_id = payload.get("sub")
    user = await db.prepare(
        "SELECT current_wedding_id FROM users WHERE id = ?"
    ).bind(user_id).first()

    if user and user["current_wedding_id"]:
        wedding = await db.prepare(
            "SELECT * FROM weddings WHERE id = ? AND is_active = 1"
        ).bind(user["current_wedding_id"]).first()
        if wedding:
            return dict(wedding)

    # Final fallback: first owned wedding
    wedding = await db.prepare(
        "SELECT * FROM weddings WHERE owner_id = ? AND is_active = 1 LIMIT 1"
    ).bind(user_id).first()
    if wedding:
        return dict(wedding)

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
