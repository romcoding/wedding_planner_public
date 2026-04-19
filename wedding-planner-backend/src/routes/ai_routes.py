import uuid
from fastapi import APIRouter, Request, Depends, HTTPException
from pydantic import BaseModel
from src.middleware import get_db, get_wedding, wedding_meets_plan, get_plan_limit

router = APIRouter()


async def _ai_gate(db, wedding: dict):
    """Check plan and daily usage. Returns None if allowed, raises HTTPException if not."""
    if not wedding_meets_plan(wedding, "starter"):
        raise HTTPException(402, {
            "error": "AI features require the Starter plan or higher.",
            "current_plan": wedding.get("plan"),
            "upgrade_url": "/admin/billing",
        })

    limit = get_plan_limit(wedding, "ai_uses_per_day")
    wedding_id = wedding["id"]

    if limit == 0:
        raise HTTPException(402, {
            "error": "AI features require the Starter plan or higher.",
            "current_plan": wedding.get("plan"),
            "upgrade_url": "/admin/billing",
        })

    # Count today's usage
    today_row = await db.prepare(
        "SELECT COUNT(*) as count FROM ai_usage WHERE wedding_id = ? "
        "AND date(used_at) = date('now')"
    ).bind(wedding_id).first()
    today_count = today_row["count"] if today_row else 0

    if limit is not None and today_count >= limit:
        raise HTTPException(429, {
            "error": "Daily AI limit reached. Upgrade to Premium for unlimited AI.",
            "count": today_count,
            "limit": limit,
            "upgrade_url": "/admin/billing",
        })

    # Increment usage
    await db.prepare(
        "INSERT INTO ai_usage (id, wedding_id, endpoint, used_at) VALUES (?, ?, 'ai', datetime('now'))"
    ).bind(str(uuid.uuid4()), wedding_id).run()


@router.get("/usage")
async def get_ai_usage(
    wedding: dict = Depends(get_wedding),
    request: Request = None,
):
    db = await get_db(request)
    today_row = await db.prepare(
        "SELECT COUNT(*) as count FROM ai_usage WHERE wedding_id = ? AND date(used_at) = date('now')"
    ).bind(wedding["id"]).first()
    count = today_row["count"] if today_row else 0
    limit = get_plan_limit(wedding, "ai_uses_per_day")
    return {
        "count": count,
        "limit": limit,
        "plan": wedding.get("plan"),
        "unlimited": limit is None,
    }


class TimelineBody(BaseModel):
    wedding_date: str
    location: str
    guest_count: int
    ceremony_type: str


@router.post("/timeline")
async def ai_timeline(
    body: TimelineBody,
    wedding: dict = Depends(get_wedding),
    request: Request = None,
):
    db = await get_db(request)
    await _ai_gate(db, wedding)

    from src.services.ai_service import generate_timeline
    try:
        result = generate_timeline(
            wedding_date=body.wedding_date,
            location=body.location,
            guest_count=body.guest_count,
            ceremony_type=body.ceremony_type,
        )
    except RuntimeError as e:
        raise HTTPException(502, str(e))
    return result


class VendorBody(BaseModel):
    budget: float
    location: str
    style_preferences: str
    guest_count: int


@router.post("/vendor-suggestions")
async def ai_vendor_suggestions(
    body: VendorBody,
    wedding: dict = Depends(get_wedding),
    request: Request = None,
):
    db = await get_db(request)
    await _ai_gate(db, wedding)

    from src.services.ai_service import generate_vendor_suggestions
    try:
        result = generate_vendor_suggestions(
            budget=body.budget,
            location=body.location,
            style_preferences=body.style_preferences,
            guest_count=body.guest_count,
        )
    except RuntimeError as e:
        raise HTTPException(502, str(e))
    return result


class CopyBody(BaseModel):
    couple_names: str
    wedding_date: str
    location: str
    story_notes: str


@router.post("/copy-generator")
async def ai_copy_generator(
    body: CopyBody,
    wedding: dict = Depends(get_wedding),
    request: Request = None,
):
    db = await get_db(request)
    await _ai_gate(db, wedding)

    from src.services.ai_service import generate_website_copy
    try:
        result = generate_website_copy(
            couple_names=body.couple_names,
            wedding_date=body.wedding_date,
            location=body.location,
            story_notes=body.story_notes,
        )
    except RuntimeError as e:
        raise HTTPException(502, str(e))
    return result


class SeatingBody(BaseModel):
    guests: list[dict]


@router.post("/seating")
async def ai_seating(
    body: SeatingBody,
    wedding: dict = Depends(get_wedding),
    request: Request = None,
):
    db = await get_db(request)
    await _ai_gate(db, wedding)

    if not body.guests:
        raise HTTPException(400, "guests array is required")
    if len(body.guests) > 500:
        raise HTTPException(400, "Too many guests. Maximum 500 per request.")

    from src.services.ai_service import generate_seating_suggestions
    try:
        result = generate_seating_suggestions(guests=body.guests)
    except RuntimeError as e:
        raise HTTPException(502, str(e))
    return result
