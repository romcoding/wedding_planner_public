import uuid
from fastapi import APIRouter, Request, Depends, HTTPException
from pydantic import BaseModel
from src.middleware import get_db, get_wedding

router = APIRouter()


class ReminderBody(BaseModel):
    name: str | None = None
    message: str | None = None
    send_at: str | None = None
    target_rsvp_status: str | None = None


@router.get("")
async def list_reminders(wedding: dict = Depends(get_wedding), request: Request = None):
    db = await get_db(request)
    result = await db.prepare(
        "SELECT * FROM rsvp_reminders WHERE wedding_id = ? ORDER BY send_at ASC"
    ).bind(wedding["id"]).all()
    return [dict(r) for r in (result.results or [])]


@router.post("", status_code=201)
async def create_reminder(
    body: ReminderBody,
    wedding: dict = Depends(get_wedding),
    request: Request = None,
):
    db = await get_db(request)
    if not body.name or not body.message or not body.send_at:
        raise HTTPException(400, "name, message, and send_at are required")

    rid = str(uuid.uuid4())
    await db.prepare(
        "INSERT INTO rsvp_reminders (id, wedding_id, name, message, send_at, status, "
        "target_rsvp_status, created_at) VALUES (?, ?, ?, ?, ?, 'pending', ?, datetime('now'))"
    ).bind(rid, wedding["id"], body.name, body.message, body.send_at, body.target_rsvp_status).run()

    r = await db.prepare("SELECT * FROM rsvp_reminders WHERE id = ?").bind(rid).first()
    return dict(r)


@router.delete("/{reminder_id}")
async def delete_reminder(
    reminder_id: str,
    wedding: dict = Depends(get_wedding),
    request: Request = None,
):
    db = await get_db(request)
    r = await db.prepare(
        "SELECT id FROM rsvp_reminders WHERE id = ? AND wedding_id = ?"
    ).bind(reminder_id, wedding["id"]).first()
    if not r:
        raise HTTPException(404, "Reminder not found")
    await db.prepare("DELETE FROM reminder_sent WHERE reminder_id = ?").bind(reminder_id).run()
    await db.prepare("DELETE FROM rsvp_reminders WHERE id = ?").bind(reminder_id).run()
    return {"message": "Reminder deleted successfully"}
