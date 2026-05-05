import uuid
import secrets
import json
from fastapi import APIRouter, Request, Depends, HTTPException, Query
from pydantic import BaseModel
from auth import require_admin_auth, create_guest_token
from middleware import get_db, get_wedding

router = APIRouter()


class CreateGuestBody(BaseModel):
    first_name: str
    last_name: str
    email: str
    phone: str | None = None
    rsvp_status: str | None = "pending"
    overnight_stay: bool | None = False
    number_of_guests: int | None = 1
    invitee_names: list[str] | None = None
    dietary_restrictions: str | None = None
    allergies: str | None = None
    special_requests: str | None = None
    music_wish: str | None = None
    address: str | None = None
    notes: str | None = None
    language: str | None = "en"


class UpdateGuestBody(BaseModel):
    first_name: str | None = None
    last_name: str | None = None
    email: str | None = None
    phone: str | None = None
    rsvp_status: str | None = None
    overnight_stay: bool | None = None
    number_of_guests: int | None = None
    invitee_names: list[str] | None = None
    attending_names: list[str] | None = None
    dietary_restrictions: str | None = None
    allergies: str | None = None
    special_requests: str | None = None
    music_wish: str | None = None
    address: str | None = None
    notes: str | None = None
    language: str | None = None


class UpdateRsvpBody(BaseModel):
    rsvp_status: str | None = None
    overnight_stay: bool | None = None
    number_of_guests: int | None = None
    attending_names: list[str] | None = None
    dietary_restrictions: str | None = None
    allergies: str | None = None
    special_requests: str | None = None
    music_wish: str | None = None
    phone: str | None = None
    address: str | None = None


def _guest_dict(g: dict, include_token: bool = False) -> dict:
    out = {
        "id": g["id"],
        "wedding_id": g.get("wedding_id"),
        "first_name": g["first_name"],
        "last_name": g["last_name"],
        "email": g["email"],
        "phone": g.get("phone"),
        "rsvp_status": g.get("rsvp_status", "pending"),
        "overnight_stay": bool(g.get("overnight_stay", 0)),
        "number_of_guests": g.get("number_of_guests", 1),
        "invitee_names": json.loads(g["invitee_names"]) if g.get("invitee_names") else [],
        "attending_names": json.loads(g["attending_names"]) if g.get("attending_names") else [],
        "dietary_restrictions": g.get("dietary_restrictions"),
        "allergies": g.get("allergies"),
        "special_requests": g.get("special_requests"),
        "music_wish": g.get("music_wish"),
        "address": g.get("address"),
        "notes": g.get("notes"),
        "language": g.get("language", "en"),
        "registered_at": g.get("registered_at"),
        "updated_at": g.get("updated_at"),
        "last_accessed": g.get("last_accessed"),
    }
    if include_token:
        out["unique_token"] = g.get("unique_token")
    return out


@router.put("/update-rsvp")
async def update_rsvp(body: UpdateRsvpBody, request: Request):
    """Update RSVP — requires guest JWT."""
    from auth import decode_token
    auth = request.headers.get("Authorization", "")
    if not auth.startswith("Bearer "):
        raise HTTPException(403, "Guest token required")
    try:
        payload = decode_token(auth[7:])
    except Exception:
        raise HTTPException(403, "Invalid token")

    sub = str(payload.get("sub", ""))
    if not sub.startswith("guest_"):
        raise HTTPException(403, "Guest token required")
    guest_id = sub[6:]

    db = await get_db(request)
    guest = await db.prepare("SELECT * FROM guests WHERE id = ?").bind(guest_id).first()
    if not guest:
        raise HTTPException(404, "Guest not found")

    updates = []
    binds = []

    if body.rsvp_status is not None:
        updates.append("rsvp_status = ?"); binds.append(body.rsvp_status)
    if body.overnight_stay is not None:
        updates.append("overnight_stay = ?"); binds.append(int(body.overnight_stay))
    if body.number_of_guests is not None:
        updates.append("number_of_guests = ?"); binds.append(body.number_of_guests)
    if body.attending_names is not None:
        updates.append("attending_names = ?"); binds.append(json.dumps(body.attending_names))
        if body.rsvp_status == "confirmed":
            updates.append("number_of_guests = ?"); binds.append(len(body.attending_names))
    if body.dietary_restrictions is not None:
        updates.append("dietary_restrictions = ?"); binds.append(body.dietary_restrictions)
    if body.allergies is not None:
        updates.append("allergies = ?"); binds.append(body.allergies)
    if body.special_requests is not None:
        updates.append("special_requests = ?"); binds.append(body.special_requests)
    if body.music_wish is not None:
        updates.append("music_wish = ?"); binds.append(body.music_wish)
    if body.phone is not None:
        updates.append("phone = ?"); binds.append(body.phone)
    if body.address is not None:
        updates.append("address = ?"); binds.append(body.address)

    updates.append("updated_at = datetime('now')")
    updates.append("last_accessed = datetime('now')")
    binds.append(guest_id)

    await db.prepare(
        f"UPDATE guests SET {', '.join(updates)} WHERE id = ?"
    ).bind(*binds).run()

    updated = await db.prepare("SELECT * FROM guests WHERE id = ?").bind(guest_id).first()
    return {"message": "RSVP updated successfully", "guest": _guest_dict(dict(updated))}


@router.post("", status_code=201)
async def create_guest(
    body: CreateGuestBody,
    wedding: dict = Depends(get_wedding),
    request: Request = None,
):
    db = await get_db(request)
    import os
    frontend_url = os.environ.get("FRONTEND_URL", "http://localhost:5173")
    wedding_id = wedding["id"]
    guest_id = str(uuid.uuid4())
    token = secrets.token_urlsafe(32)

    await db.prepare(
        "INSERT INTO guests (id, wedding_id, first_name, last_name, email, phone, unique_token, "
        "rsvp_status, overnight_stay, number_of_guests, invitee_names, dietary_restrictions, "
        "allergies, special_requests, music_wish, address, notes, language, "
        "registered_at, updated_at) "
        "VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))"
    ).bind(
        guest_id, wedding_id, body.first_name, body.last_name, body.email,
        body.phone, token, body.rsvp_status or "pending",
        int(body.overnight_stay or False), body.number_of_guests or 1,
        json.dumps(body.invitee_names) if body.invitee_names else None,
        body.dietary_restrictions, body.allergies, body.special_requests,
        body.music_wish, body.address, body.notes, body.language or "en",
    ).run()

    guest = await db.prepare("SELECT * FROM guests WHERE id = ?").bind(guest_id).first()
    guest_dict = _guest_dict(dict(guest), include_token=True)
    rsvp_link = f"{frontend_url}/rsvp/{token}"
    guest_dict["rsvp_link"] = rsvp_link
    return {"message": "Guest created successfully", "guest": guest_dict, "rsvp_link": rsvp_link}


@router.get("")
async def get_guests(
    wedding: dict = Depends(get_wedding),
    rsvp_status: str | None = None,
    overnight_stay: str | None = None,
    request: Request = None,
):
    db = await get_db(request)
    import os
    frontend_url = os.environ.get("FRONTEND_URL", "http://localhost:5173")
    wedding_id = wedding["id"]

    sql = "SELECT * FROM guests WHERE wedding_id = ?"
    binds = [wedding_id]

    if rsvp_status:
        sql += " AND rsvp_status = ?"; binds.append(rsvp_status)
    if overnight_stay is not None:
        sql += " AND overnight_stay = ?"; binds.append(1 if overnight_stay.lower() == "true" else 0)

    sql += " ORDER BY registered_at DESC"
    result = await db.prepare(sql).bind(*binds).all()
    guests = []
    for g in (result.results or []):
        gd = _guest_dict(dict(g), include_token=True)
        gd["rsvp_link"] = f"{frontend_url}/rsvp/{g['unique_token']}"
        guests.append(gd)
    return guests


@router.get("/token/{token}")
async def get_guest_by_token(token: str, request: Request):
    """Public endpoint for RSVP link."""
    db = await get_db(request)
    guest = await db.prepare("SELECT * FROM guests WHERE unique_token = ?").bind(token).first()
    if not guest:
        raise HTTPException(404, "Invalid RSVP link")
    await db.prepare(
        "UPDATE guests SET last_accessed = datetime('now') WHERE id = ?"
    ).bind(guest["id"]).run()
    return _guest_dict(dict(guest))


@router.post("/token/{token}/auth")
async def authenticate_guest_token(token: str, request: Request):
    """Public: authenticate guest via RSVP token, return JWT."""
    db = await get_db(request)
    guest = await db.prepare("SELECT * FROM guests WHERE unique_token = ?").bind(token).first()
    if not guest:
        raise HTTPException(404, "Invalid RSVP link")
    guest = dict(guest)
    await db.prepare(
        "UPDATE guests SET last_accessed = datetime('now') WHERE id = ?"
    ).bind(guest["id"]).run()
    access_token = create_guest_token(guest["id"], guest.get("wedding_id"))
    return {"access_token": access_token, "guest": _guest_dict(guest)}


@router.get("/{guest_id}")
async def get_guest(
    guest_id: str,
    wedding: dict = Depends(get_wedding),
    request: Request = None,
):
    db = await get_db(request)
    import os
    frontend_url = os.environ.get("FRONTEND_URL", "http://localhost:5173")
    guest = await db.prepare(
        "SELECT * FROM guests WHERE id = ? AND wedding_id = ?"
    ).bind(guest_id, wedding["id"]).first()
    if not guest:
        raise HTTPException(404, "Guest not found")
    gd = _guest_dict(dict(guest), include_token=True)
    gd["rsvp_link"] = f"{frontend_url}/rsvp/{guest['unique_token']}"
    return gd


@router.put("/{guest_id}")
async def update_guest(
    guest_id: str,
    body: UpdateGuestBody,
    wedding: dict = Depends(get_wedding),
    request: Request = None,
):
    db = await get_db(request)
    guest = await db.prepare(
        "SELECT * FROM guests WHERE id = ? AND wedding_id = ?"
    ).bind(guest_id, wedding["id"]).first()
    if not guest:
        raise HTTPException(404, "Guest not found")

    updates = []
    binds = []

    simple_fields = [
        ("first_name", body.first_name),
        ("last_name", body.last_name),
        ("email", body.email),
        ("phone", body.phone),
        ("rsvp_status", body.rsvp_status),
        ("overnight_stay", int(body.overnight_stay) if body.overnight_stay is not None else None),
        ("number_of_guests", body.number_of_guests),
        ("dietary_restrictions", body.dietary_restrictions),
        ("allergies", body.allergies),
        ("special_requests", body.special_requests),
        ("music_wish", body.music_wish),
        ("address", body.address),
        ("notes", body.notes),
        ("language", body.language),
    ]
    for col, val in simple_fields:
        if val is not None:
            updates.append(f"{col} = ?"); binds.append(val)

    if body.invitee_names is not None:
        updates.append("invitee_names = ?")
        binds.append(json.dumps(body.invitee_names) if body.invitee_names else None)
    if body.attending_names is not None:
        updates.append("attending_names = ?")
        binds.append(json.dumps(body.attending_names) if body.attending_names else None)

    if updates:
        updates.append("updated_at = datetime('now')")
        binds.append(guest_id)
        await db.prepare(
            f"UPDATE guests SET {', '.join(updates)} WHERE id = ?"
        ).bind(*binds).run()

    updated = await db.prepare("SELECT * FROM guests WHERE id = ?").bind(guest_id).first()
    return _guest_dict(dict(updated))


@router.delete("/{guest_id}")
async def delete_guest(
    guest_id: str,
    wedding: dict = Depends(get_wedding),
    request: Request = None,
):
    db = await get_db(request)
    guest = await db.prepare(
        "SELECT id FROM guests WHERE id = ? AND wedding_id = ?"
    ).bind(guest_id, wedding["id"]).first()
    if not guest:
        raise HTTPException(404, "Guest not found")

    # Clean up references
    await db.prepare("UPDATE invitations SET guest_id = NULL WHERE guest_id = ?").bind(guest_id).run()
    await db.prepare("UPDATE seat_assignments SET guest_id = NULL WHERE guest_id = ?").bind(guest_id).run()
    await db.prepare("DELETE FROM guest_photos WHERE guest_id = ?").bind(guest_id).run()
    await db.prepare("DELETE FROM reminder_sent WHERE guest_id = ?").bind(guest_id).run()
    await db.prepare("UPDATE messages SET guest_id = NULL WHERE guest_id = ?").bind(guest_id).run()
    await db.prepare("DELETE FROM guests WHERE id = ?").bind(guest_id).run()

    return {"message": "Guest deleted successfully"}
