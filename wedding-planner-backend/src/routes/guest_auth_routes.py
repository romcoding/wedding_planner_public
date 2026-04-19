"""Guest authentication routes — token-based passwordless auth for wedding guests."""
from fastapi import APIRouter, Request, Depends, HTTPException
from src.auth import create_guest_token, decode_token
from src.middleware import get_db

router = APIRouter()


@router.get("/profile")
async def guest_profile(request: Request):
    auth = request.headers.get("Authorization", "")
    if not auth.startswith("Bearer "):
        raise HTTPException(401, "Guest token required")
    try:
        payload = decode_token(auth[7:])
    except Exception:
        raise HTTPException(401, "Invalid token")

    sub = str(payload.get("sub", ""))
    if not sub.startswith("guest_"):
        raise HTTPException(401, "Guest token required")
    guest_id = sub[6:]

    db = await get_db(request)
    guest = await db.prepare("SELECT * FROM guests WHERE id = ?").bind(guest_id).first()
    if not guest:
        raise HTTPException(404, "Guest not found")

    guest = dict(guest)
    return {
        "id": guest["id"],
        "first_name": guest["first_name"],
        "last_name": guest["last_name"],
        "email": guest["email"],
        "rsvp_status": guest.get("rsvp_status"),
        "language": guest.get("language", "en"),
        "wedding_id": guest.get("wedding_id"),
    }
