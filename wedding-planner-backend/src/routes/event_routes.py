import uuid
from fastapi import APIRouter, Request, Depends, HTTPException
from pydantic import BaseModel
from src.auth import require_admin_auth
from src.middleware import get_db, get_wedding

router = APIRouter()


class EventBody(BaseModel):
    name: str | None = None
    description: str | None = None
    location: str | None = None
    start_time: str | None = None
    end_time: str | None = None
    is_public: bool | None = True
    is_active: bool | None = True


@router.get("")
async def list_events(
    payload: dict = Depends(require_admin_auth),
    request: Request = None,
):
    db = await get_db(request)
    result = await db.prepare(
        "SELECT * FROM events ORDER BY start_time ASC"
    ).all()
    return [dict(e) for e in (result.results or [])]


@router.post("", status_code=201)
async def create_event(
    body: EventBody,
    payload: dict = Depends(require_admin_auth),
    request: Request = None,
):
    db = await get_db(request)
    if not body.name:
        raise HTTPException(400, "Name is required")

    event_id = str(uuid.uuid4())
    await db.prepare(
        "INSERT INTO events (id, user_id, name, description, location, start_time, end_time, "
        "is_public, is_active, created_at, updated_at) "
        "VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))"
    ).bind(
        event_id, payload["sub"], body.name, body.description, body.location,
        body.start_time, body.end_time,
        int(body.is_public if body.is_public is not None else 1),
        int(body.is_active if body.is_active is not None else 1),
    ).run()

    event = await db.prepare("SELECT * FROM events WHERE id = ?").bind(event_id).first()
    return dict(event)


@router.put("/{event_id}")
async def update_event(
    event_id: str,
    body: EventBody,
    payload: dict = Depends(require_admin_auth),
    request: Request = None,
):
    db = await get_db(request)
    event = await db.prepare("SELECT * FROM events WHERE id = ?").bind(event_id).first()
    if not event:
        raise HTTPException(404, "Event not found")

    updates, binds = [], []
    for col, val in [
        ("name", body.name), ("description", body.description),
        ("location", body.location), ("start_time", body.start_time), ("end_time", body.end_time),
    ]:
        if val is not None:
            updates.append(f"{col} = ?"); binds.append(val)
    if body.is_public is not None:
        updates.append("is_public = ?"); binds.append(int(body.is_public))
    if body.is_active is not None:
        updates.append("is_active = ?"); binds.append(int(body.is_active))

    if updates:
        updates.append("updated_at = datetime('now')")
        binds.append(event_id)
        await db.prepare(f"UPDATE events SET {', '.join(updates)} WHERE id = ?").bind(*binds).run()

    updated = await db.prepare("SELECT * FROM events WHERE id = ?").bind(event_id).first()
    return dict(updated)


@router.delete("/{event_id}")
async def delete_event(
    event_id: str,
    payload: dict = Depends(require_admin_auth),
    request: Request = None,
):
    db = await get_db(request)
    event = await db.prepare("SELECT id FROM events WHERE id = ?").bind(event_id).first()
    if not event:
        raise HTTPException(404, "Event not found")
    await db.prepare("DELETE FROM events WHERE id = ?").bind(event_id).run()
    return {"message": "Event deleted successfully"}
