from fastapi import APIRouter, Request, Depends, HTTPException
from auth import require_admin_auth
from middleware import get_db, get_wedding

router = APIRouter()


@router.get("/status")
async def onboarding_status(
    payload: dict = Depends(require_admin_auth),
    request: Request = None,
):
    """Return onboarding completion state for the authenticated user."""
    db = await get_db(request)
    user_id = payload["sub"]

    user = await db.prepare("SELECT * FROM users WHERE id = ?").bind(user_id).first()
    if not user:
        raise HTTPException(404, "User not found")
    user = dict(user)

    wedding = None
    if user.get("current_wedding_id"):
        wedding = await db.prepare(
            "SELECT * FROM weddings WHERE id = ?"
        ).bind(user["current_wedding_id"]).first()

    has_wedding = wedding is not None
    has_guests = False
    if has_wedding:
        g = await db.prepare(
            "SELECT COUNT(*) as c FROM guests WHERE wedding_id = ?"
        ).bind(wedding["id"]).first()
        has_guests = (g["c"] if g else 0) > 0

    return {
        "has_account": True,
        "has_wedding": has_wedding,
        "has_guests": has_guests,
        "wedding": dict(wedding) if wedding else None,
        "steps_complete": sum([has_wedding, has_guests]),
        "total_steps": 2,
    }


@router.post("/complete")
async def complete_onboarding(
    payload: dict = Depends(require_admin_auth),
    request: Request = None,
):
    """Mark onboarding as complete — no-op in this version, returns current status."""
    return await onboarding_status(payload=payload, request=request)
