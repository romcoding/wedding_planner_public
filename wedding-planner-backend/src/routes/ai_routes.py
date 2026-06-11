import uuid
from fastapi import APIRouter, Request, Depends, HTTPException
from pydantic import BaseModel
from middleware import get_db, get_wedding
from entitlements import get_plan, get_limit, plan_has_feature

from db import row_to_dict, rows_to_list

router = APIRouter()


async def _ai_gate(db, wedding: dict):
    """Check plan and daily usage. Returns None if allowed, raises HTTPException if not."""
    plan = get_plan(wedding)
    if not plan_has_feature(plan, "ai"):
        raise HTTPException(402, {
            "error": "AI features require the Premium plan or higher.",
            "current_plan": plan,
            "upgrade_url": "/admin/billing",
        })

    limit = get_limit(plan, "ai_uses_per_day")
    wedding_id = wedding["id"]

    if limit == 0:
        raise HTTPException(402, {
            "error": "AI features require the Premium plan or higher.",
            "current_plan": plan,
            "upgrade_url": "/admin/billing",
        })

    # Count today's usage
    today_row_raw = await db.prepare(
        "SELECT COUNT(*) as count FROM ai_usage WHERE wedding_id = ? "
        "AND date(used_at) = date('now')"
    ).bind(wedding_id).first()
    today_row = row_to_dict(today_row_raw)
    today_count = today_row.get("count") if today_row else 0

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
    today_row_raw = await db.prepare(
        "SELECT COUNT(*) as count FROM ai_usage WHERE wedding_id = ? AND date(used_at) = date('now')"
    ).bind(wedding["id"]).first()
    today_row = row_to_dict(today_row_raw)
    count = today_row.get("count") if today_row else 0
    plan = get_plan(wedding)
    limit = get_limit(plan, "ai_uses_per_day")
    return {
        "count": count,
        "limit": limit,
        "plan": plan,
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

    from services.ai_service import generate_timeline
    try:
        result = generate_timeline(
            wedding_date=body.wedding_date,
            location=body.location,
            guest_count=body.guest_count,
            ceremony_type=body.ceremony_type,
        )
    except RuntimeError as e:
        print(f"[ai] request failed: {e}")
        raise HTTPException(502, "AI request failed. Please try again later.")
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

    from services.ai_service import generate_vendor_suggestions
    try:
        result = generate_vendor_suggestions(
            budget=body.budget,
            location=body.location,
            style_preferences=body.style_preferences,
            guest_count=body.guest_count,
        )
    except RuntimeError as e:
        print(f"[ai] request failed: {e}")
        raise HTTPException(502, "AI request failed. Please try again later.")
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

    from services.ai_service import generate_website_copy
    try:
        result = generate_website_copy(
            couple_names=body.couple_names,
            wedding_date=body.wedding_date,
            location=body.location,
            story_notes=body.story_notes,
        )
    except RuntimeError as e:
        print(f"[ai] request failed: {e}")
        raise HTTPException(502, "AI request failed. Please try again later.")
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

    from services.ai_service import generate_seating_suggestions
    try:
        result = generate_seating_suggestions(guests=body.guests)
    except RuntimeError as e:
        print(f"[ai] request failed: {e}")
        raise HTTPException(502, "AI request failed. Please try again later.")
    return result
