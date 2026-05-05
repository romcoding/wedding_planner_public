import uuid
from fastapi import APIRouter, Request, Depends, HTTPException
from pydantic import BaseModel
from middleware import get_db, get_wedding

router = APIRouter()


class GiftBody(BaseModel):
    title: str | None = None
    description: str | None = None
    price: float | None = None
    url: str | None = None
    image_url: str | None = None
    is_purchased: bool | None = False
    purchased_by: str | None = None


@router.get("")
async def list_gifts(wedding: dict = Depends(get_wedding), request: Request = None):
    db = await get_db(request)
    result = await db.prepare(
        "SELECT * FROM gift_registry WHERE wedding_id = ? ORDER BY created_at DESC"
    ).bind(wedding["id"]).all()
    return [dict(g) for g in (result.results or [])]


@router.post("", status_code=201)
async def create_gift(
    body: GiftBody,
    wedding: dict = Depends(get_wedding),
    request: Request = None,
):
    db = await get_db(request)
    if not body.title:
        raise HTTPException(400, "Title is required")
    gift_id = str(uuid.uuid4())
    await db.prepare(
        "INSERT INTO gift_registry (id, wedding_id, title, description, price, url, image_url, "
        "is_purchased, purchased_by, created_at) "
        "VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))"
    ).bind(
        gift_id, wedding["id"], body.title, body.description, body.price, body.url,
        body.image_url, int(body.is_purchased or False), body.purchased_by,
    ).run()
    gift = await db.prepare("SELECT * FROM gift_registry WHERE id = ?").bind(gift_id).first()
    return dict(gift)


@router.put("/{gift_id}")
async def update_gift(
    gift_id: str,
    body: GiftBody,
    wedding: dict = Depends(get_wedding),
    request: Request = None,
):
    db = await get_db(request)
    gift = await db.prepare(
        "SELECT id FROM gift_registry WHERE id = ? AND wedding_id = ?"
    ).bind(gift_id, wedding["id"]).first()
    if not gift:
        raise HTTPException(404, "Gift not found")

    updates, binds = [], []
    for col, val in [
        ("title", body.title), ("description", body.description), ("price", body.price),
        ("url", body.url), ("image_url", body.image_url), ("purchased_by", body.purchased_by),
    ]:
        if val is not None:
            updates.append(f"{col} = ?"); binds.append(val)
    if body.is_purchased is not None:
        updates.append("is_purchased = ?"); binds.append(int(body.is_purchased))

    if updates:
        binds.append(gift_id)
        await db.prepare(f"UPDATE gift_registry SET {', '.join(updates)} WHERE id = ?").bind(*binds).run()

    updated = await db.prepare("SELECT * FROM gift_registry WHERE id = ?").bind(gift_id).first()
    return dict(updated)


@router.delete("/{gift_id}")
async def delete_gift(
    gift_id: str,
    wedding: dict = Depends(get_wedding),
    request: Request = None,
):
    db = await get_db(request)
    gift = await db.prepare(
        "SELECT id FROM gift_registry WHERE id = ? AND wedding_id = ?"
    ).bind(gift_id, wedding["id"]).first()
    if not gift:
        raise HTTPException(404, "Gift not found")
    await db.prepare("DELETE FROM gift_registry WHERE id = ?").bind(gift_id).run()
    return {"message": "Gift deleted successfully"}
