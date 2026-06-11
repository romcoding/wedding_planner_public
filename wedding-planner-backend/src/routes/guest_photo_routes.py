import uuid
from fastapi import APIRouter, Request, Depends, HTTPException
from pydantic import BaseModel
from auth import decode_token
from middleware import get_db
from entitlements import require_feature

_gate = require_feature("guest_photos")

from db import row_to_dict, rows_to_list

router = APIRouter()


class PhotoBody(BaseModel):
    file_url: str
    caption: str | None = None
    guest_id: str | None = None


@router.get("")
async def list_photos(wedding: dict = Depends(_gate), request: Request = None):
    db = await get_db(request)
    result = await db.prepare(
        "SELECT gp.*, g.first_name, g.last_name FROM guest_photos gp "
        "LEFT JOIN guests g ON gp.guest_id = g.id "
        "WHERE gp.wedding_id = ? ORDER BY gp.uploaded_at DESC"
    ).bind(wedding["id"]).all()
    return rows_to_list(result)


@router.post("", status_code=201)
async def upload_photo(body: PhotoBody, request: Request):
    """Upload a guest photo — works with both guest and admin tokens."""
    auth = request.headers.get("Authorization", "")
    if not auth.startswith("Bearer "):
        raise HTTPException(401, "Token required")
    try:
        payload = decode_token(auth[7:])
    except Exception:
        raise HTTPException(401, "Invalid token")

    wedding_id = payload.get("wedding_id")
    sub = str(payload.get("sub", ""))
    guest_id = sub[6:] if sub.startswith("guest_") else body.guest_id

    if not wedding_id:
        raise HTTPException(400, "No wedding context in token")

    db = await get_db(request)

    # Verify a client-supplied guest_id belongs to this wedding (admin upload
    # path); guest tokens derive guest_id from their own sub.
    if guest_id:
        guest = await db.prepare(
            "SELECT id FROM guests WHERE id = ? AND wedding_id = ?"
        ).bind(guest_id, wedding_id).first()
        if not guest:
            raise HTTPException(404, "Guest not found")

    photo_id = str(uuid.uuid4())
    await db.prepare(
        "INSERT INTO guest_photos (id, wedding_id, guest_id, file_url, caption, is_approved, uploaded_at) "
        "VALUES (?, ?, ?, ?, ?, 0, datetime('now'))"
    ).bind(photo_id, wedding_id, guest_id, body.file_url, body.caption).run()

    photo = await db.prepare("SELECT * FROM guest_photos WHERE id = ?").bind(photo_id).first()
    return row_to_dict(photo)


@router.put("/{photo_id}/approve")
async def approve_photo(photo_id: str, wedding: dict = Depends(_gate), request: Request = None):
    db = await get_db(request)
    await db.prepare(
        "UPDATE guest_photos SET is_approved = 1 WHERE id = ? AND wedding_id = ?"
    ).bind(photo_id, wedding["id"]).run()
    return {"message": "Photo approved"}


@router.delete("/{photo_id}")
async def delete_photo(photo_id: str, wedding: dict = Depends(_gate), request: Request = None):
    db = await get_db(request)
    await db.prepare(
        "DELETE FROM guest_photos WHERE id = ? AND wedding_id = ?"
    ).bind(photo_id, wedding["id"]).run()
    return {"message": "Photo deleted"}
