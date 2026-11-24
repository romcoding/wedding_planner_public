import json
import uuid
from datetime import date, datetime, timezone
from fastapi import APIRouter, Request, Depends, HTTPException
from pydantic import BaseModel
from middleware import get_db, get_wedding, require_platform_admin

from db import row_to_dict, rows_to_list

router = APIRouter()


class PageViewBody(BaseModel):
    path: str
    referrer: str | None = None
    user_agent: str | None = None
    session_id: str | None = None
    # Published-site slug. Resolved server-side to the owning wedding; a
    # wedding_id is NEVER accepted from the client.
    slug: str | None = None


def _cap(value, limit: int = 512):
    """Bound an attacker-controlled string field; None stays None."""
    if value is None:
        return None
    return str(value)[:limit]


@router.post("/track")
async def track_page_view(body: PageViewBody, request: Request):
    """Public: track a page view. Does not require auth."""
    db = await get_db(request)

    # Operator precedence fix: the CF header must win even when request.client
    # is None (the `if/else` previously bound tighter than `or`).
    ip = request.headers.get("CF-Connecting-IP") or (
        request.client.host if request.client else None
    )

    # 60/IP/hour durable limit on this unauthenticated, attacker-reachable ingest.
    try:
        env = request.scope["env"]
    except Exception:
        env = None
    from services import rate_limit
    if not await rate_limit.check(env, f"track:ip:{ip}", 60, 3600):
        raise HTTPException(429, "Too many requests")

    wedding_id = None
    if body.slug:
        site = row_to_dict(await db.prepare(
            "SELECT wedding_id FROM wedding_sites WHERE slug = ? AND status = 'published'"
        ).bind(_cap(body.slug, 128)).first())
        if not site:
            # Unknown/unpublished slug: store nothing (and don't reveal which).
            return {"tracked": False}
        wedding_id = site["wedding_id"]

    view_id = str(uuid.uuid4())
    ua = _cap(body.user_agent or request.headers.get("User-Agent"))
    await db.prepare(
        "INSERT INTO page_views (id, wedding_id, path, referrer, user_agent, ip_address, created_at) "
        "VALUES (?, ?, ?, ?, ?, ?, datetime('now'))"
    ).bind(view_id, wedding_id, _cap(body.path), _cap(body.referrer), ua, ip).run()
    return {"tracked": True}


def _names(raw) -> list[str]:
    """Parse a JSON-list TEXT column into non-empty names ([] when absent/corrupt)."""
    if not raw:
        return []
    try:
        val = json.loads(raw)
    except (TypeError, ValueError):
        return []
    if not isinstance(val, list):
        return []
    return [str(n).strip() for n in val if str(n or "").strip()]


def _party_size(g: dict) -> int:
    """People in the household invited by this row.

    ``invitee_names`` is the full party (RSVP.jsx falls back to the guest's own
    name when it is empty). ``number_of_guests`` is the party size too, but an
    RSVP overwrites it with the attending count, so take the larger of the two
    and never less than one.
    """
    return max(len(_names(g.get("invitee_names"))), int(g.get("number_of_guests") or 1), 1)


def _attending(g: dict) -> int:
    """People attending for a confirmed household."""
    names = _names(g.get("attending_names"))
    return len(names) if names else min(int(g.get("number_of_guests") or 1), _party_size(g))


def _days_until(raw) -> int | None:
    """Whole days from today (UTC) to a 'YYYY-MM-DD[...]' wedding date; None if unparseable."""
    if not raw:
        return None
    try:
        d = date.fromisoformat(str(raw)[:10])
    except ValueError:
        return None
    return (d - datetime.now(timezone.utc).date()).days


@router.get("/overview")
async def analytics_overview(
    wedding: dict = Depends(get_wedding),
    request: Request = None,
):
    """Single per-wedding summary behind the couple dashboard.

    ``guests`` counts households (rows); ``headcount`` counts people:
      * confirmed – people attending in confirmed households
      * declined  – whole parties that declined, plus invited-but-not-attending
                    members of confirmed households
      * pending   – whole parties that have not answered
      * invited   – confirmed + declined + pending
    ``overnight`` and ``dietary`` look at households that have not declined.
    ``budget``: planned = every cost line, paid = paid lines, remaining = planned - paid.
    """
    db = await get_db(request)
    wedding_id = wedding["id"]

    guest_rows = rows_to_list(await db.prepare(
        "SELECT rsvp_status, number_of_guests, invitee_names, attending_names, overnight_stay, "
        "dietary_restrictions, allergies, special_requests "
        "FROM guests WHERE wedding_id = ?"
    ).bind(wedding_id).all())

    by_status = {"pending": 0, "confirmed": 0, "declined": 0}
    headcount = {"invited": 0, "confirmed": 0, "pending": 0, "declined": 0}
    overnight = {"yes": 0, "no": 0}
    dietary = {"with_restrictions": 0, "with_allergies": 0, "with_special_requests": 0}
    for g in guest_rows:
        st = g.get("rsvp_status") or "pending"
        by_status[st] = by_status.get(st, 0) + 1
        party = _party_size(g)
        if st == "confirmed":
            n = _attending(g)
            headcount["confirmed"] += n
            headcount["declined"] += max(party - n, 0)
            overnight["yes" if g.get("overnight_stay") else "no"] += n
        elif st == "declined":
            headcount["declined"] += party
        else:
            headcount["pending"] += party
        if st != "declined":
            for key, col in (("with_restrictions", "dietary_restrictions"),
                             ("with_allergies", "allergies"),
                             ("with_special_requests", "special_requests")):
                if (g.get(col) or "").strip():
                    dietary[key] += 1
    headcount["invited"] = headcount["confirmed"] + headcount["pending"] + headcount["declined"]

    tasks_result = await db.prepare(
        "SELECT status, COUNT(*) as count FROM tasks WHERE wedding_id = ? GROUP BY status"
    ).bind(wedding_id).all()
    task_counts = {}
    for row in rows_to_list(tasks_result):
        task_counts[row.get("status")] = row.get("count")

    costs_result = await db.prepare(
        "SELECT SUM(amount) as total, status FROM costs WHERE wedding_id = ? GROUP BY status"
    ).bind(wedding_id).all()
    cost_totals = {}
    for row in rows_to_list(costs_result):
        cost_totals[row.get("status")] = float(row.get("total") or 0)
    planned = sum(cost_totals.values())
    paid = cost_totals.get("paid", 0.0)

    ai_result_raw = await db.prepare(
        "SELECT COUNT(*) as count FROM ai_usage WHERE wedding_id = ? AND used_at >= date('now', 'start of day')"
    ).bind(wedding_id).first()
    ai_result = row_to_dict(ai_result_raw)
    ai_today = ai_result.get("count") if ai_result else 0

    return {
        "guests": {"total": len(guest_rows), "by_status": by_status},
        "headcount": headcount,
        "overnight": overnight,
        "dietary": dietary,
        "budget": {"planned": planned, "paid": paid, "remaining": planned - paid},
        "currency": wedding.get("currency") or "CHF",
        "wedding_date": wedding.get("wedding_date"),
        "days_until": _days_until(wedding.get("wedding_date")),
        "tasks": task_counts,
        "ai_usage_today": ai_today,
        "plan": wedding.get("plan"),
    }


@router.get("/rsvp-progress")
async def rsvp_progress(
    wedding: dict = Depends(get_wedding),
    request: Request = None,
):
    """RSVP answers per day (households), bucketed by ``guests.updated_at``.

    updated_at also moves on later edits, so a day is "last touched", not
    "first answered" — good enough for a progress curve. The client accumulates.
    """
    db = await get_db(request)
    rows = rows_to_list(await db.prepare(
        "SELECT date(updated_at) AS day, rsvp_status, COUNT(*) AS count FROM guests "
        "WHERE wedding_id = ? AND rsvp_status IN ('confirmed', 'declined') "
        "GROUP BY day, rsvp_status ORDER BY day ASC"
    ).bind(wedding["id"]).all())
    daily: dict[str, dict] = {}
    for r in rows:
        d = daily.setdefault(r["day"], {"date": r["day"], "confirmed": 0, "declined": 0})
        d[r["rsvp_status"]] = r["count"]
    total = int((row_to_dict(await db.prepare(
        "SELECT COUNT(*) AS count FROM guests WHERE wedding_id = ?"
    ).bind(wedding["id"]).first()) or {}).get("count") or 0)
    return {"total_guests": total, "daily": list(daily.values())}


@router.get("/site-stats")
async def site_stats(
    days: int = 30,
    wedding: dict = Depends(get_wedding),
    request: Request = None,
):
    """Page views of THIS wedding's published site (filtered by wedding_id)."""
    db = await get_db(request)
    days = max(1, min(int(days), 365))
    since = f"-{days} days"
    wid = wedding["id"]

    totals = row_to_dict(await db.prepare(
        "SELECT COUNT(*) AS views, COUNT(DISTINCT ip_address) AS visitors FROM page_views "
        "WHERE wedding_id = ? AND created_at >= datetime('now', ?)"
    ).bind(wid, since).first()) or {}
    daily = rows_to_list(await db.prepare(
        "SELECT date(created_at) AS date, COUNT(*) AS count FROM page_views "
        "WHERE wedding_id = ? AND created_at >= datetime('now', ?) GROUP BY date ORDER BY date ASC"
    ).bind(wid, since).all())
    top = rows_to_list(await db.prepare(
        "SELECT path, COUNT(*) AS views FROM page_views "
        "WHERE wedding_id = ? AND created_at >= datetime('now', ?) "
        "GROUP BY path ORDER BY views DESC, path ASC LIMIT 10"
    ).bind(wid, since).all())
    return {
        "days": days,
        "total_views": totals.get("views") or 0,
        "unique_visitors": totals.get("visitors") or 0,
        "daily_views": daily,
        "top_pages": top,
    }


@router.get("/security")
async def security_events(
    payload: dict = Depends(require_platform_admin),
    request: Request = None,
):
    db = await get_db(request)
    result = await db.prepare(
        "SELECT * FROM security_events ORDER BY created_at DESC LIMIT 100"
    ).all()
    return rows_to_list(result)
