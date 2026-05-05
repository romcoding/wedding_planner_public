import uuid
from fastapi import APIRouter, Request, Depends, HTTPException
from pydantic import BaseModel
from auth import require_admin_auth
from middleware import get_db, get_wedding

router = APIRouter()


class MoodboardBody(BaseModel):
    name: str


class ElementBody(BaseModel):
    type: str
    content: str | None = None
    x: float | None = None
    y: float | None = None
    width: float | None = None
    height: float | None = None
    rotation: float | None = 0
    z_index: int | None = 0
    properties: str | None = None


@router.get("/moodboards")
async def list_moodboards(
    payload: dict = Depends(require_admin_auth),
    request: Request = None,
):
    db = await get_db(request)
    result = await db.prepare(
        "SELECT * FROM moodboards WHERE user_id = ? ORDER BY created_at DESC"
    ).bind(payload["sub"]).all()
    return [dict(m) for m in (result.results or [])]


@router.post("/moodboards", status_code=201)
async def create_moodboard(
    body: MoodboardBody,
    payload: dict = Depends(require_admin_auth),
    request: Request = None,
):
    db = await get_db(request)
    mid = str(uuid.uuid4())
    await db.prepare(
        "INSERT INTO moodboards (id, user_id, name, created_at, updated_at) "
        "VALUES (?, ?, ?, datetime('now'), datetime('now'))"
    ).bind(mid, payload["sub"], body.name).run()
    m = await db.prepare("SELECT * FROM moodboards WHERE id = ?").bind(mid).first()
    return dict(m)


@router.get("/moodboards/{moodboard_id}")
async def get_moodboard(
    moodboard_id: str,
    payload: dict = Depends(require_admin_auth),
    request: Request = None,
):
    db = await get_db(request)
    m = await db.prepare("SELECT * FROM moodboards WHERE id = ?").bind(moodboard_id).first()
    if not m:
        raise HTTPException(404, "Moodboard not found")
    m = dict(m)
    elements_r = await db.prepare(
        "SELECT * FROM moodboard_elements WHERE moodboard_id = ? ORDER BY z_index ASC"
    ).bind(moodboard_id).all()
    m["elements"] = [dict(e) for e in (elements_r.results or [])]
    return m


@router.put("/moodboards/{moodboard_id}")
async def save_moodboard(
    moodboard_id: str,
    request: Request,
    payload: dict = Depends(require_admin_auth),
):
    db = await get_db(request)
    body = await request.json()
    elements = body.get("elements", [])

    # Delete existing elements and reinsert
    await db.prepare("DELETE FROM moodboard_elements WHERE moodboard_id = ?").bind(moodboard_id).run()
    for el in elements:
        eid = str(uuid.uuid4())
        await db.prepare(
            "INSERT INTO moodboard_elements (id, moodboard_id, type, content, x, y, width, height, "
            "rotation, z_index, properties, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))"
        ).bind(
            eid, moodboard_id, el.get("type"), el.get("content"),
            el.get("x"), el.get("y"), el.get("width"), el.get("height"),
            el.get("rotation", 0), el.get("z_index", 0),
            el.get("properties") if isinstance(el.get("properties"), str) else None,
        ).run()

    await db.prepare(
        "UPDATE moodboards SET updated_at = datetime('now') WHERE id = ?"
    ).bind(moodboard_id).run()
    return {"message": "Moodboard saved"}


@router.delete("/moodboards/{moodboard_id}")
async def delete_moodboard(
    moodboard_id: str,
    payload: dict = Depends(require_admin_auth),
    request: Request = None,
):
    db = await get_db(request)
    await db.prepare("DELETE FROM moodboard_elements WHERE moodboard_id = ?").bind(moodboard_id).run()
    await db.prepare("DELETE FROM moodboards WHERE id = ?").bind(moodboard_id).run()
    return {"message": "Moodboard deleted"}
