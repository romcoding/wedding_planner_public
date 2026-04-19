import uuid
from fastapi import APIRouter, Request, Depends, HTTPException
from pydantic import BaseModel
from src.middleware import get_db, get_wedding

router = APIRouter()


class AgendaBody(BaseModel):
    title: str | None = None
    description: str | None = None
    start_time: str | None = None
    end_time: str | None = None
    location: str | None = None
    responsible_person: str | None = None
    order: int | None = 0


@router.get("")
async def list_agenda(wedding: dict = Depends(get_wedding), request: Request = None):
    db = await get_db(request)
    result = await db.prepare(
        "SELECT * FROM agenda_items WHERE wedding_id = ? ORDER BY start_time ASC, \"order\" ASC"
    ).bind(wedding["id"]).all()
    return [dict(a) for a in (result.results or [])]


@router.post("", status_code=201)
async def create_agenda_item(
    body: AgendaBody,
    wedding: dict = Depends(get_wedding),
    request: Request = None,
):
    db = await get_db(request)
    if not body.title:
        raise HTTPException(400, "Title is required")
    if not body.start_time:
        raise HTTPException(400, "Start time is required")

    item_id = str(uuid.uuid4())
    await db.prepare(
        "INSERT INTO agenda_items (id, wedding_id, title, description, start_time, end_time, "
        "location, responsible_person, \"order\", created_at, updated_at) "
        "VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))"
    ).bind(
        item_id, wedding["id"], body.title, body.description, body.start_time,
        body.end_time, body.location, body.responsible_person, body.order or 0,
    ).run()

    item = await db.prepare("SELECT * FROM agenda_items WHERE id = ?").bind(item_id).first()
    return dict(item)


@router.put("/{item_id}")
async def update_agenda_item(
    item_id: str,
    body: AgendaBody,
    wedding: dict = Depends(get_wedding),
    request: Request = None,
):
    db = await get_db(request)
    item = await db.prepare(
        "SELECT id FROM agenda_items WHERE id = ? AND wedding_id = ?"
    ).bind(item_id, wedding["id"]).first()
    if not item:
        raise HTTPException(404, "Agenda item not found")

    updates, binds = [], []
    for col, val in [
        ("title", body.title), ("description", body.description),
        ("start_time", body.start_time), ("end_time", body.end_time),
        ("location", body.location), ("responsible_person", body.responsible_person),
        ("\"order\"", body.order),
    ]:
        if val is not None:
            updates.append(f"{col} = ?"); binds.append(val)

    if updates:
        updates.append("updated_at = datetime('now')")
        binds.append(item_id)
        await db.prepare(f"UPDATE agenda_items SET {', '.join(updates)} WHERE id = ?").bind(*binds).run()

    updated = await db.prepare("SELECT * FROM agenda_items WHERE id = ?").bind(item_id).first()
    return dict(updated)


@router.delete("/{item_id}")
async def delete_agenda_item(
    item_id: str,
    wedding: dict = Depends(get_wedding),
    request: Request = None,
):
    db = await get_db(request)
    item = await db.prepare(
        "SELECT id FROM agenda_items WHERE id = ? AND wedding_id = ?"
    ).bind(item_id, wedding["id"]).first()
    if not item:
        raise HTTPException(404, "Agenda item not found")
    await db.prepare("DELETE FROM agenda_items WHERE id = ?").bind(item_id).run()
    return {"message": "Agenda item deleted successfully"}
