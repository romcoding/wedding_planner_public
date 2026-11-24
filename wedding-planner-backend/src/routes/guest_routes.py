import uuid
import secrets
import json
import csv
import io
from fastapi import APIRouter, Request, Depends, HTTPException, Query
from fastapi.responses import Response
from pydantic import BaseModel
from auth import create_guest_token
from middleware import get_db, get_wedding
from entitlements import enforce_limit, remaining_capacity, limit_reached, get_limit, get_plan
from services.urls import rsvp_link as _rsvp_link

from db import row_to_dict, rows_to_list

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


# ---------- RSVP / guest field validation ----------

RSVP_STATUSES = ("pending", "confirmed", "declined")
MAX_TEXT = 500
_TEXT_FIELDS = ("dietary_restrictions", "allergies", "special_requests",
                "music_wish", "address", "notes", "phone")


def _invalid(code: str, detail: str, **extra) -> HTTPException:
    return HTTPException(422, {"code": code, "detail": detail, **extra})


def _check_status(value) -> None:
    if value is not None and value not in RSVP_STATUSES:
        raise _invalid("invalid_rsvp_status",
                       f"rsvp_status must be one of: {', '.join(RSVP_STATUSES)}")


def _check_text(body) -> None:
    for field in _TEXT_FIELDS:
        v = getattr(body, field, None)
        if v is not None and len(v) > MAX_TEXT:
            raise _invalid("field_too_long", f"{field} is too long (max {MAX_TEXT} characters)", field=field)


def _norm(name: str) -> str:
    return " ".join(str(name or "").split()).casefold()


def _stored_names(raw) -> list[str]:
    try:
        val = json.loads(raw) if raw else []
    except (TypeError, ValueError):
        return []
    return [str(n) for n in val] if isinstance(val, list) else []


def _household(first: str, last: str, invitees: list[str]) -> dict[str, str]:
    """casefolded name -> canonical spelling for everyone in the household."""
    out: dict[str, str] = {}
    for n in [f"{first or ''} {last or ''}".strip(), *invitees]:
        n = " ".join(str(n or "").split())
        if n:
            out.setdefault(_norm(n), n)
    return out


def _resolve_attending(names: list[str], household: dict[str, str]) -> list[str]:
    """Canonicalise attending names; 422 if any is not in the household."""
    resolved: list[str] = []
    bad: list[str] = []
    for n in names:
        key = _norm(n)
        if not key:
            continue
        if key not in household:
            bad.append(str(n)[:100])
        elif household[key] not in resolved:
            resolved.append(household[key])
    if bad:
        raise _invalid("invalid_attending_names",
                       "attending_names must be people in this household", invalid_names=bad)
    return resolved


def _party_cap(invitees: list[str]) -> int:
    return 1 + len(invitees)


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
    guest_raw = await db.prepare("SELECT * FROM guests WHERE id = ?").bind(guest_id).first()
    guest = row_to_dict(guest_raw)
    if not guest:
        raise HTTPException(404, "Guest not found")

    _check_status(body.rsvp_status)
    _check_text(body)

    invitees = _stored_names(guest.get("invitee_names"))
    final_status = body.rsvp_status if body.rsvp_status is not None else guest.get("rsvp_status")

    updates = []
    binds = []

    if body.rsvp_status is not None:
        updates.append("rsvp_status = ?"); binds.append(body.rsvp_status)
    if body.overnight_stay is not None:
        updates.append("overnight_stay = ?"); binds.append(int(body.overnight_stay))
    if body.attending_names is not None:
        household = _household(guest.get("first_name"), guest.get("last_name"), invitees)
        attending = _resolve_attending(body.attending_names, household)
        if final_status == "declined":
            attending = []  # nobody attends a declined household
        updates.append("attending_names = ?"); binds.append(json.dumps(attending))
        # Party size is derived from who is attending, never trusted from the client.
        updates.append("number_of_guests = ?"); binds.append(len(attending))
    elif body.number_of_guests is not None:
        updates.append("number_of_guests = ?")
        binds.append(max(0, min(int(body.number_of_guests), _party_cap(invitees))))
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

    updated_raw = await db.prepare("SELECT * FROM guests WHERE id = ?").bind(guest_id).first()
    updated = (row_to_dict(updated_raw) or {})
    return {"message": "RSVP updated successfully", "guest": _guest_dict(updated)}


@router.post("", status_code=201)
async def create_guest(
    body: CreateGuestBody,
    wedding: dict = Depends(get_wedding),
    request: Request = None,
):
    db = await get_db(request)
    _check_status(body.rsvp_status)
    _check_text(body)
    await enforce_limit(db, wedding, "max_guests")
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
    guest_dict = _guest_dict(row_to_dict(guest), include_token=True)
    rsvp_link = _rsvp_link(frontend_url, token)
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
    for g in rows_to_list(result):
        gd = _guest_dict(g, include_token=True)
        gd["rsvp_link"] = _rsvp_link(frontend_url, g.get('unique_token'))
        guests.append(gd)
    return guests


@router.get("/token/{token}")
async def get_guest_by_token(token: str, request: Request):
    """Public endpoint for RSVP link."""
    db = await get_db(request)
    guest_raw = await db.prepare("SELECT * FROM guests WHERE unique_token = ?").bind(token).first()
    if not guest_raw:
        raise HTTPException(404, "Invalid RSVP link")
    guest = row_to_dict(guest_raw)
    await db.prepare(
        "UPDATE guests SET last_accessed = datetime('now') WHERE id = ?"
    ).bind(guest.get("id")).run()
    return _guest_dict(guest)


@router.post("/token/{token}/auth")
async def authenticate_guest_token(token: str, request: Request):
    """Public: authenticate guest via RSVP token, return JWT."""
    db = await get_db(request)
    guest_raw = await db.prepare("SELECT * FROM guests WHERE unique_token = ?").bind(token).first()
    if not guest_raw:
        raise HTTPException(404, "Invalid RSVP link")
    guest = row_to_dict(guest_raw)
    await db.prepare(
        "UPDATE guests SET last_accessed = datetime('now') WHERE id = ?"
    ).bind(guest.get("id")).run()
    access_token = create_guest_token(guest.get("id"), guest.get("wedding_id"))
    return {"access_token": access_token, "guest": _guest_dict(guest)}


CSV_EXPORT_COLUMNS = [
    "first_name",
    "last_name",
    "email",
    "phone",
    "rsvp_status",
    "overnight_stay",
    "number_of_guests",
    "invitee_names",
    "dietary_restrictions",
    "allergies",
    "special_requests",
    "music_wish",
    "address",
    "notes",
    "language",
]


def _csv_truthy(value: str | None) -> bool:
    if value is None:
        return False
    return str(value).strip().lower() in {"1", "true", "yes", "y", "ja", "oui"}


def _split_names(value: str | None) -> list[str]:
    if not value:
        return []
    parts: list[str] = []
    for chunk in str(value).replace("|", ";").split(";"):
        name = chunk.strip()
        if name:
            parts.append(name)
    return parts


def _csv_safe(value):
    """Neutralize CSV/formula injection.

    Cells beginning with = + - @ are interpreted as formulas by Excel/Sheets;
    prefix them with a single quote so they render as literal text.
    """
    if isinstance(value, str) and value[:1] in ("=", "+", "-", "@"):
        return "'" + value
    return value


@router.get("/export")
async def export_guests_csv(
    wedding: dict = Depends(get_wedding),
    request: Request = None,
):
    """Download all guests as CSV. Boolean and JSON fields are normalised so
    the file round-trips through the import endpoint."""
    db = await get_db(request)
    result = await db.prepare(
        "SELECT * FROM guests WHERE wedding_id = ? ORDER BY last_name, first_name"
    ).bind(wedding["id"]).all()

    buffer = io.StringIO()
    writer = csv.DictWriter(buffer, fieldnames=CSV_EXPORT_COLUMNS)
    writer.writeheader()
    for raw in result.results or []:
        guest = row_to_dict(raw)
        names = json.loads(guest["invitee_names"]) if guest.get("invitee_names") else []
        row_values = {
            "first_name": guest.get("first_name") or "",
            "last_name": guest.get("last_name") or "",
            "email": guest.get("email") or "",
            "phone": guest.get("phone") or "",
            "rsvp_status": guest.get("rsvp_status") or "pending",
            "overnight_stay": "true" if guest.get("overnight_stay") else "false",
            "number_of_guests": guest.get("number_of_guests") or 1,
            "invitee_names": "; ".join(names),
            "dietary_restrictions": guest.get("dietary_restrictions") or "",
            "allergies": guest.get("allergies") or "",
            "special_requests": guest.get("special_requests") or "",
            "music_wish": guest.get("music_wish") or "",
            "address": guest.get("address") or "",
            "notes": guest.get("notes") or "",
            "language": guest.get("language") or "en",
        }
        writer.writerow({k: _csv_safe(v) for k, v in row_values.items()})

    return Response(
        content=buffer.getvalue(),
        media_type="text/csv; charset=utf-8",
        headers={
            "Content-Disposition": 'attachment; filename="guests.csv"',
        },
    )


@router.post("/import")
async def import_guests_csv(
    request: Request,
    wedding: dict = Depends(get_wedding),
):
    """Bulk-create guests from a CSV upload. Accepts the headers produced by
    the export endpoint. Returns per-row results so the UI can flag bad rows
    without aborting the whole import."""
    body = await request.body()
    if not body:
        raise HTTPException(400, "CSV body is required")
    try:
        text = body.decode("utf-8-sig")
    except UnicodeDecodeError:
        raise HTTPException(400, "CSV must be UTF-8 encoded")

    reader = csv.DictReader(io.StringIO(text))
    if not reader.fieldnames:
        raise HTTPException(400, "CSV has no header row")

    required = {"first_name", "last_name", "email"}
    missing = required - {h.strip() for h in reader.fieldnames}
    if missing:
        raise HTTPException(
            400,
            f"CSV is missing required columns: {', '.join(sorted(missing))}",
        )

    db = await get_db(request)
    import os
    frontend_url = os.environ.get("FRONTEND_URL", "http://localhost:5173")

    # Plan limit: stop at the limit and report what was left out.
    remaining = await remaining_capacity(db, wedding, "max_guests")
    limit = get_limit(get_plan(wedding), "max_guests")
    if remaining is not None and remaining <= 0:
        raise limit_reached(limit, "guests")

    existing = {
        (r.get("email") or "").strip().lower()
        for r in rows_to_list(await db.prepare(
            "SELECT email FROM guests WHERE wedding_id = ?").bind(wedding["id"]).all())
    }

    created = 0
    errors: list[dict] = []
    skipped_duplicates: list[dict] = []
    not_imported: list[dict] = []

    for index, row in enumerate(reader, start=2):  # row 1 is header
        first_name = (row.get("first_name") or "").strip()
        last_name = (row.get("last_name") or "").strip()
        email = (row.get("email") or "").strip()
        if not first_name or not last_name or not email:
            errors.append({
                "row": index,
                "error": "first_name, last_name and email are required",
            })
            continue

        status = (row.get("rsvp_status") or "pending").strip().lower() or "pending"
        if status not in RSVP_STATUSES:
            errors.append({"row": index, "error": f"rsvp_status must be one of: {', '.join(RSVP_STATUSES)}"})
            continue

        if email.lower() in existing:
            skipped_duplicates.append({"row": index, "email": email})
            continue

        if remaining is not None and created >= remaining:
            not_imported.append({"row": index, "email": email, "reason": "limit_reached"})
            continue

        try:
            number_of_guests = int(row.get("number_of_guests") or 1)
        except (TypeError, ValueError):
            number_of_guests = 1
        names = _split_names(row.get("invitee_names"))

        guest_id = str(uuid.uuid4())
        token = secrets.token_urlsafe(32)
        try:
            await db.prepare(
                "INSERT INTO guests (id, wedding_id, first_name, last_name, email, phone, "
                "unique_token, rsvp_status, overnight_stay, number_of_guests, invitee_names, "
                "dietary_restrictions, allergies, special_requests, music_wish, address, notes, "
                "language, registered_at, updated_at) VALUES "
                "(?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))"
            ).bind(
                guest_id,
                wedding["id"],
                first_name,
                last_name,
                email,
                (row.get("phone") or "").strip() or None,
                token,
                status,
                1 if _csv_truthy(row.get("overnight_stay")) else 0,
                number_of_guests,
                json.dumps(names) if names else None,
                (row.get("dietary_restrictions") or "").strip() or None,
                (row.get("allergies") or "").strip() or None,
                (row.get("special_requests") or "").strip() or None,
                (row.get("music_wish") or "").strip() or None,
                (row.get("address") or "").strip() or None,
                (row.get("notes") or "").strip() or None,
                (row.get("language") or "en").strip() or "en",
            ).run()
            created += 1
            existing.add(email.lower())
        except Exception as exc:  # pragma: no cover - DB-specific error surface
            errors.append({"row": index, "error": str(exc)})

    return {
        "created": created,
        "errors": errors,
        "skipped_duplicates": skipped_duplicates,
        "not_imported": not_imported,
        "limit": limit,
        "limit_reached": bool(not_imported),
        "frontend_url": frontend_url,
    }


@router.get("/{guest_id}")
async def get_guest(
    guest_id: str,
    wedding: dict = Depends(get_wedding),
    request: Request = None,
):
    db = await get_db(request)
    import os
    frontend_url = os.environ.get("FRONTEND_URL", "http://localhost:5173")
    guest_raw = await db.prepare(
        "SELECT * FROM guests WHERE id = ? AND wedding_id = ?"
    ).bind(guest_id, wedding["id"]).first()
    if not guest_raw:
        raise HTTPException(404, "Guest not found")
    guest = row_to_dict(guest_raw)
    gd = _guest_dict(guest, include_token=True)
    gd["rsvp_link"] = _rsvp_link(frontend_url, guest.get('unique_token'))
    return gd


@router.put("/{guest_id}")
async def update_guest(
    guest_id: str,
    body: UpdateGuestBody,
    wedding: dict = Depends(get_wedding),
    request: Request = None,
):
    db = await get_db(request)
    guest_raw = await db.prepare(
        "SELECT * FROM guests WHERE id = ? AND wedding_id = ?"
    ).bind(guest_id, wedding["id"]).first()
    guest = row_to_dict(guest_raw)
    if not guest:
        raise HTTPException(404, "Guest not found")

    _check_status(body.rsvp_status)
    _check_text(body)
    invitees = (body.invitee_names if body.invitee_names is not None
                else _stored_names(guest.get("invitee_names")))
    attending_resolved = None
    if body.attending_names is not None:
        household = _household(
            body.first_name if body.first_name is not None else guest.get("first_name"),
            body.last_name if body.last_name is not None else guest.get("last_name"),
            invitees,
        )
        attending_resolved = _resolve_attending(body.attending_names, household)
    if body.number_of_guests is not None and attending_resolved is None:
        body.number_of_guests = max(0, min(int(body.number_of_guests), _party_cap(invitees)))
    if attending_resolved is not None:
        body.number_of_guests = len(attending_resolved)

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
        binds.append(json.dumps(attending_resolved) if attending_resolved else None)

    if updates:
        updates.append("updated_at = datetime('now')")
        binds.append(guest_id)
        await db.prepare(
            f"UPDATE guests SET {', '.join(updates)} WHERE id = ?"
        ).bind(*binds).run()

    updated_raw = await db.prepare("SELECT * FROM guests WHERE id = ?").bind(guest_id).first()
    updated = (row_to_dict(updated_raw) or {})
    return _guest_dict(updated)


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

    # All cleanup succeeds or fails together. Seat assignments are DELETED (a
    # NULL-guest row would be an orphaned seat nobody can identify).
    await db.batch([
        db.prepare("UPDATE invitations SET guest_id = NULL WHERE guest_id = ?").bind(guest_id),
        db.prepare("DELETE FROM seat_assignments WHERE guest_id = ?").bind(guest_id),
        db.prepare("DELETE FROM guest_photos WHERE guest_id = ?").bind(guest_id),
        db.prepare("DELETE FROM reminder_sent WHERE guest_id = ?").bind(guest_id),
        db.prepare("UPDATE messages SET guest_id = NULL WHERE guest_id = ?").bind(guest_id),
        db.prepare("DELETE FROM guests WHERE id = ? AND wedding_id = ?").bind(guest_id, wedding["id"]),
    ])

    return {"message": "Guest deleted successfully"}
