import uuid
from datetime import datetime, timedelta
from fastapi import APIRouter, Request, Depends, HTTPException
from auth import require_admin_auth
from middleware import get_db, get_wedding
from pydantic import BaseModel

router = APIRouter()

MAX_TEXT_FIELD_LENGTH = 300
MAX_STYLE_NOTE_LENGTH = 1000

DEFAULTS = {
    "couple_names": "Your Couple",
    "wedding_location": "Your dream venue",
    "planner_brand": "Wedding Planner Studio",
    "wedding_hashtag": "#OurBigDay",
    "style_note": "Elegant, warm and deeply personal.",
}


def _row_to_dict(row) -> dict | None:
    """Normalize Cloudflare D1 rows across dict/JsProxy representations."""
    if row is None:
        return None
    if isinstance(row, dict):
        return row
    to_py = getattr(row, "to_py", None)
    if callable(to_py):
        converted = to_py()
        if isinstance(converted, dict):
            return converted
    try:
        return dict(row)
    except Exception as exc:
        raise HTTPException(500, f"Unexpected DB row format: {type(row).__name__}") from exc


def _row_count(row, key: str = "c") -> int:
    """Read an integer aggregate (e.g. SELECT COUNT(*) AS c) from a D1 row."""
    data = _row_to_dict(row)
    if not data:
        return 0
    try:
        return int(data.get(key) or 0)
    except (TypeError, ValueError):
        return 0


class QuickSetupBody(BaseModel):
    couple_names: str | None = None
    wedding_date: str | None = None
    wedding_location: str | None = None
    planner_brand: str | None = None
    wedding_hashtag: str | None = None
    style_note: str | None = None
    force_seed_events: bool | None = False
    force_seed_tasks: bool | None = False


def _clean_text(value, fallback="", max_len=MAX_TEXT_FIELD_LENGTH):
    text = (value or "").strip()
    if not text:
        text = fallback
    return text[:max_len]


def _parse_wedding_date(raw_value):
    value = (raw_value or "").strip()
    if not value:
        return datetime.utcnow() + timedelta(days=180)
    normalized = value.replace("Z", "+00:00")
    try:
        return datetime.fromisoformat(normalized)
    except ValueError:
        raise HTTPException(400, "wedding_date must be ISO format, e.g. 2027-06-18T15:30:00")


def _build_event_template(wedding_date, wedding_location):
    return [
        ("Guest arrival & welcome drink", "Kick off the experience with music and a welcome toast.", wedding_date.replace(hour=15, minute=0), wedding_location),
        ("Ceremony", "The emotional centerpiece of the day.", wedding_date.replace(hour=16, minute=30), wedding_location),
        ("Dinner & speeches", "Dinner service, speeches and shared memories.", wedding_date.replace(hour=18, minute=0), wedding_location),
        ("Party & dance floor", "Open dance floor, DJ and celebration.", wedding_date.replace(hour=21, minute=0), wedding_location),
    ]


def _build_task_template():
    return [
        ("Define couple vision board and color palette", "decoration", "high", 120),
        ("Finalize guest list and invitation wave #1", "guests", "urgent", 90),
        ("Secure venue + catering contract", "venue", "urgent", 80),
        ("Build ceremony timeline and vendor run sheet", "planning", "high", 45),
        ("Confirm seating chart draft", "guests", "medium", 14),
    ]


@router.get("/status")
async def onboarding_status(
    payload: dict = Depends(require_admin_auth),
    request: Request = None,
):
    """Return onboarding completion state for the authenticated user."""
    db = await get_db(request)
    user_id = payload["sub"]

    user = _row_to_dict(
        await db.prepare("SELECT * FROM users WHERE id = ?").bind(user_id).first()
    )
    if not user:
        raise HTTPException(404, "User not found")

    wedding = None
    if user.get("current_wedding_id"):
        wedding = _row_to_dict(
            await db.prepare(
                "SELECT * FROM weddings WHERE id = ?"
            ).bind(user["current_wedding_id"]).first()
        )

    has_wedding = wedding is not None
    has_guests = False
    if has_wedding:
        g = await db.prepare(
            "SELECT COUNT(*) as c FROM guests WHERE wedding_id = ?"
        ).bind(wedding["id"]).first()
        has_guests = _row_count(g) > 0

    return {
        "has_account": True,
        "has_wedding": has_wedding,
        "has_guests": has_guests,
        "wedding": wedding,
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


@router.post("/quick-setup")
async def quick_setup(
    body: QuickSetupBody,
    payload: dict = Depends(require_admin_auth),
    wedding: dict = Depends(get_wedding),
    request: Request = None,
):
    """Seed a starter set of wedding content/events/tasks for the current tenant."""
    db = await get_db(request)

    wedding_date = _parse_wedding_date(body.wedding_date)
    wedding_location = _clean_text(body.wedding_location, fallback=DEFAULTS["wedding_location"])
    planner_brand = _clean_text(body.planner_brand, fallback=DEFAULTS["planner_brand"])
    wedding_hashtag = _clean_text(body.wedding_hashtag, fallback=DEFAULTS["wedding_hashtag"])
    style_note = _clean_text(body.style_note, fallback=DEFAULTS["style_note"], max_len=MAX_STYLE_NOTE_LENGTH)

    couple_names = _clean_text(
        body.couple_names,
        fallback=f"{(wedding.get('partner_one_name') or '').strip()} & {(wedding.get('partner_two_name') or '').strip()}".strip(" &"),
    )
    if not couple_names:
        couple_names = DEFAULTS["couple_names"]

    # Keep wedding tenant core fields in sync with quick-setup.
    if " & " in couple_names:
        p1, p2 = [p.strip() for p in couple_names.split(" & ", 1)]
    elif " and " in couple_names.lower():
        parts = couple_names.split(" and ", 1)
        p1, p2 = parts[0].strip(), parts[1].strip()
    else:
        p1, p2 = couple_names, ""

    await db.prepare(
        "UPDATE weddings SET partner_one_name = ?, partner_two_name = ?, wedding_date = ?, location = ?, updated_at = datetime('now') WHERE id = ?"
    ).bind(
        p1 or wedding.get("partner_one_name"),
        p2 or wedding.get("partner_two_name"),
        wedding_date.isoformat(),
        wedding_location,
        wedding["id"],
    ).run()

    # Upsert per-wedding simple public content.
    message = f"{planner_brand} created this space so each guest has a smooth, premium wedding journey. {style_note}"
    faq = f"Hashtag: {wedding_hashtag}"
    existing_content = _row_to_dict(
        await db.prepare("SELECT id FROM wedding_content WHERE wedding_id = ?").bind(wedding["id"]).first()
    )
    if existing_content:
        await db.prepare(
            "UPDATE wedding_content SET couple_names = ?, wedding_date = ?, venue = ?, message = ?, faq = ?, updated_at = datetime('now') WHERE wedding_id = ?"
        ).bind(couple_names, wedding_date.isoformat(), wedding_location, message, faq, wedding["id"]).run()
        created_content = 0
        updated_content = 1
    else:
        await db.prepare(
            "INSERT INTO wedding_content (id, wedding_id, couple_names, wedding_date, venue, message, faq, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'))"
        ).bind(str(uuid.uuid4()), wedding["id"], couple_names, wedding_date.isoformat(), wedding_location, message, faq).run()
        created_content = 1
        updated_content = 0

    existing_events = _row_count(
        await db.prepare("SELECT COUNT(*) as c FROM events WHERE wedding_id = ?").bind(wedding["id"]).first()
    )
    created_events = 0
    if existing_events == 0 or body.force_seed_events:
        for name, description, start_time, location in _build_event_template(wedding_date, wedding_location):
            await db.prepare(
                "INSERT INTO events (id, wedding_id, user_id, name, description, location, start_time, is_public, is_active, created_at, updated_at) "
                "VALUES (?, ?, ?, ?, ?, ?, ?, 1, 1, datetime('now'), datetime('now'))"
            ).bind(str(uuid.uuid4()), wedding["id"], payload["sub"], name, description, location, start_time.isoformat()).run()
            created_events += 1

    existing_tasks = _row_count(
        await db.prepare("SELECT COUNT(*) as c FROM tasks WHERE wedding_id = ?").bind(wedding["id"]).first()
    )
    created_tasks = 0
    if existing_tasks == 0 or body.force_seed_tasks:
        for title, category, priority, days_before in _build_task_template():
            due_date = (wedding_date - timedelta(days=days_before)).date().isoformat()
            await db.prepare(
                "INSERT INTO tasks (id, wedding_id, user_id, title, category, priority, status, due_date, created_at, updated_at) "
                "VALUES (?, ?, ?, ?, ?, ?, 'todo', ?, datetime('now'), datetime('now'))"
            ).bind(str(uuid.uuid4()), wedding["id"], payload["sub"], title, category, priority, due_date).run()
            created_tasks += 1

    return {
        "message": "Quick setup completed",
        "content": {"created": created_content, "updated": updated_content},
        "events": {"created": created_events, "existing": existing_events},
        "tasks": {"created": created_tasks, "existing": existing_tasks},
    }
