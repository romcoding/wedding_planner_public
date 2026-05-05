import uuid
from fastapi import APIRouter, Request, Depends, HTTPException
from pydantic import BaseModel
from middleware import get_db, get_wedding

router = APIRouter()


class TableBody(BaseModel):
    name: str
    capacity: int | None = 10
    shape: str | None = "round"
    x: float | None = None
    y: float | None = None


class AssignBody(BaseModel):
    guest_id: str | None = None
    seat_number: int | None = None


@router.get("/tables")
async def list_tables(wedding: dict = Depends(get_wedding), request: Request = None):
    db = await get_db(request)
    result = await db.prepare(
        "SELECT * FROM seating_tables WHERE wedding_id = ? ORDER BY name ASC"
    ).bind(wedding["id"]).all()
    tables = []
    for t in (result.results or []):
        t = dict(t)
        seats_r = await db.prepare(
            "SELECT sa.*, g.first_name, g.last_name FROM seat_assignments sa "
            "LEFT JOIN guests g ON sa.guest_id = g.id WHERE sa.table_id = ?"
        ).bind(t["id"]).all()
        t["assignments"] = [dict(s) for s in (seats_r.results or [])]
        tables.append(t)
    return tables


@router.post("/tables", status_code=201)
async def create_table(
    body: TableBody,
    wedding: dict = Depends(get_wedding),
    request: Request = None,
):
    db = await get_db(request)
    tid = str(uuid.uuid4())
    await db.prepare(
        "INSERT INTO seating_tables (id, wedding_id, name, capacity, shape, x, y, created_at) "
        "VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'))"
    ).bind(tid, wedding["id"], body.name, body.capacity or 10, body.shape or "round", body.x, body.y).run()
    t = await db.prepare("SELECT * FROM seating_tables WHERE id = ?").bind(tid).first()
    return dict(t)


@router.put("/tables/{table_id}")
async def update_table(
    table_id: str,
    body: TableBody,
    wedding: dict = Depends(get_wedding),
    request: Request = None,
):
    db = await get_db(request)
    t = await db.prepare(
        "SELECT id FROM seating_tables WHERE id = ? AND wedding_id = ?"
    ).bind(table_id, wedding["id"]).first()
    if not t:
        raise HTTPException(404, "Table not found")

    updates, binds = [], []
    for col, val in [("name", body.name), ("capacity", body.capacity), ("shape", body.shape), ("x", body.x), ("y", body.y)]:
        if val is not None:
            updates.append(f"{col} = ?"); binds.append(val)
    if updates:
        binds.append(table_id)
        await db.prepare(f"UPDATE seating_tables SET {', '.join(updates)} WHERE id = ?").bind(*binds).run()

    updated = await db.prepare("SELECT * FROM seating_tables WHERE id = ?").bind(table_id).first()
    return dict(updated)


@router.delete("/tables/{table_id}")
async def delete_table(
    table_id: str,
    wedding: dict = Depends(get_wedding),
    request: Request = None,
):
    db = await get_db(request)
    t = await db.prepare(
        "SELECT id FROM seating_tables WHERE id = ? AND wedding_id = ?"
    ).bind(table_id, wedding["id"]).first()
    if not t:
        raise HTTPException(404, "Table not found")
    await db.prepare("DELETE FROM seat_assignments WHERE table_id = ?").bind(table_id).run()
    await db.prepare("DELETE FROM seating_tables WHERE id = ?").bind(table_id).run()
    return {"message": "Table deleted successfully"}


@router.post("/tables/{table_id}/assign", status_code=201)
async def assign_seat(
    table_id: str,
    body: AssignBody,
    wedding: dict = Depends(get_wedding),
    request: Request = None,
):
    db = await get_db(request)
    t = await db.prepare(
        "SELECT * FROM seating_tables WHERE id = ? AND wedding_id = ?"
    ).bind(table_id, wedding["id"]).first()
    if not t:
        raise HTTPException(404, "Table not found")

    # Remove existing assignment for this guest if any
    if body.guest_id:
        await db.prepare(
            "DELETE FROM seat_assignments WHERE guest_id = ? AND wedding_id = ?"
        ).bind(body.guest_id, wedding["id"]).run()

    assign_id = str(uuid.uuid4())
    await db.prepare(
        "INSERT INTO seat_assignments (id, table_id, wedding_id, guest_id, seat_number, created_at) "
        "VALUES (?, ?, ?, ?, ?, datetime('now'))"
    ).bind(assign_id, table_id, wedding["id"], body.guest_id, body.seat_number).run()

    sa = await db.prepare("SELECT * FROM seat_assignments WHERE id = ?").bind(assign_id).first()
    return dict(sa)


@router.delete("/assignments/{assignment_id}")
async def remove_assignment(
    assignment_id: str,
    wedding: dict = Depends(get_wedding),
    request: Request = None,
):
    db = await get_db(request)
    await db.prepare(
        "DELETE FROM seat_assignments WHERE id = ? AND wedding_id = ?"
    ).bind(assignment_id, wedding["id"]).run()
    return {"message": "Assignment removed"}
