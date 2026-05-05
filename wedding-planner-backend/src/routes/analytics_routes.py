import uuid
from fastapi import APIRouter, Request, Depends, HTTPException
from pydantic import BaseModel
from auth import require_admin_auth
from middleware import get_db, get_wedding

router = APIRouter()


class PageViewBody(BaseModel):
    path: str
    referrer: str | None = None
    user_agent: str | None = None
    session_id: str | None = None


@router.post("/track")
async def track_page_view(body: PageViewBody, request: Request):
    """Public: track a page view. Does not require auth."""
    db = await get_db(request)
    view_id = str(uuid.uuid4())
    ip = request.headers.get("CF-Connecting-IP") or request.client.host if request.client else None
    ua = body.user_agent or request.headers.get("User-Agent")
    await db.prepare(
        "INSERT INTO page_views (id, path, referrer, user_agent, ip_address, created_at) "
        "VALUES (?, ?, ?, ?, ?, datetime('now'))"
    ).bind(view_id, body.path, body.referrer, ua, ip).run()
    return {"tracked": True}


@router.get("/overview")
async def analytics_overview(
    wedding: dict = Depends(get_wedding),
    request: Request = None,
):
    db = await get_db(request)
    wedding_id = wedding["id"]

    guests_result = await db.prepare(
        "SELECT rsvp_status, COUNT(*) as count FROM guests WHERE wedding_id = ? GROUP BY rsvp_status"
    ).bind(wedding_id).all()

    rsvp_counts = {"pending": 0, "confirmed": 0, "declined": 0}
    total_guests = 0
    for row in (guests_result.results or []):
        st = row["rsvp_status"] or "pending"
        cnt = row["count"] or 0
        rsvp_counts[st] = cnt
        total_guests += cnt

    tasks_result = await db.prepare(
        "SELECT status, COUNT(*) as count FROM tasks WHERE wedding_id = ? GROUP BY status"
    ).bind(wedding_id).all()
    task_counts = {}
    for row in (tasks_result.results or []):
        task_counts[row["status"]] = row["count"]

    costs_result = await db.prepare(
        "SELECT SUM(amount) as total, status FROM costs WHERE wedding_id = ? GROUP BY status"
    ).bind(wedding_id).all()
    cost_totals = {}
    for row in (costs_result.results or []):
        cost_totals[row["status"]] = float(row["total"] or 0)

    ai_result = await db.prepare(
        "SELECT COUNT(*) as count FROM ai_usage WHERE wedding_id = ? AND used_at >= date('now', 'start of day')"
    ).bind(wedding_id).first()
    ai_today = ai_result["count"] if ai_result else 0

    return {
        "guests": {
            "total": total_guests,
            "by_status": rsvp_counts,
        },
        "tasks": task_counts,
        "budget": cost_totals,
        "ai_usage_today": ai_today,
        "plan": wedding.get("plan"),
    }


@router.get("/security")
async def security_events(
    payload: dict = Depends(require_admin_auth),
    request: Request = None,
):
    db = await get_db(request)
    result = await db.prepare(
        "SELECT * FROM security_events ORDER BY created_at DESC LIMIT 100"
    ).all()
    return [dict(e) for e in (result.results or [])]
