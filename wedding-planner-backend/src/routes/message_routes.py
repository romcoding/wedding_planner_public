import uuid
from fastapi import APIRouter, Request, Depends, HTTPException
from pydantic import BaseModel
from middleware import get_db, get_wedding
from entitlements import require_feature

_gate = require_feature("messages")

router = APIRouter()


class MessageBody(BaseModel):
    content: str
    guest_id: str | None = None
    sender_type: str | None = "admin"


@router.get("")
async def list_messages(wedding: dict = Depends(_gate), request: Request = None):
    db = await get_db(request)
    result = await db.prepare(
        "SELECT m.*, g.first_name, g.last_name FROM messages m "
        "LEFT JOIN guests g ON m.guest_id = g.id AND g.wedding_id = ? "
        "WHERE m.wedding_id = ? ORDER BY m.created_at ASC"
    ).bind(wedding["id"], wedding["id"]).all()
    return [dict(r) for r in (result.results or [])]


@router.post("", status_code=201)
async def create_message(
    body: MessageBody,
    wedding: dict = Depends(_gate),
    request: Request = None,
):
    db = await get_db(request)
    if not body.content:
        raise HTTPException(400, "Content is required")

    # Verify a client-supplied guest_id belongs to this wedding before insert.
    if body.guest_id:
        guest = await db.prepare(
            "SELECT id FROM guests WHERE id = ? AND wedding_id = ?"
        ).bind(body.guest_id, wedding["id"]).first()
        if not guest:
            raise HTTPException(404, "Guest not found")

    msg_id = str(uuid.uuid4())
    await db.prepare(
        "INSERT INTO messages (id, wedding_id, guest_id, content, sender_type, is_read, created_at) "
        "VALUES (?, ?, ?, ?, ?, 0, datetime('now'))"
    ).bind(msg_id, wedding["id"], body.guest_id, body.content, body.sender_type or "admin").run()

    msg = await db.prepare("SELECT * FROM messages WHERE id = ?").bind(msg_id).first()
    return dict(msg)


@router.put("/{message_id}/read")
async def mark_read(message_id: str, wedding: dict = Depends(_gate), request: Request = None):
    db = await get_db(request)
    await db.prepare(
        "UPDATE messages SET is_read = 1 WHERE id = ? AND wedding_id = ?"
    ).bind(message_id, wedding["id"]).run()
    return {"message": "Marked as read"}
