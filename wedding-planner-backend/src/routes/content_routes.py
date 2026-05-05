import uuid
from fastapi import APIRouter, Request, Depends, HTTPException
from pydantic import BaseModel
from auth import require_admin_auth
from middleware import get_db

router = APIRouter()


class ContentBody(BaseModel):
    key: str | None = None
    title: str | None = None
    content: str | None = None
    content_en: str | None = None
    content_de: str | None = None
    content_fr: str | None = None
    content_type: str | None = "html"
    is_public: bool | None = True
    order: int | None = 0
    scheduled_publish_at: str | None = None
    scheduled_unpublish_at: str | None = None


@router.get("")
async def get_content(request: Request, admin: str | None = None, lang: str | None = "en"):
    """Public or admin content listing."""
    db = await get_db(request)

    if admin and admin.lower() == "true":
        # Try to verify admin auth
        try:
            payload = await require_admin_auth(request)
        except HTTPException:
            raise HTTPException(401, "Unauthorized")
        result = await db.prepare("SELECT * FROM content ORDER BY \"order\" ASC").all()
    else:
        result = await db.prepare(
            "SELECT * FROM content WHERE is_public = 1 ORDER BY \"order\" ASC"
        ).all()

    items = []
    for c in (result.results or []):
        c = dict(c)
        body_key = f"content_{lang}" if lang and f"content_{lang}" in c else "content_en"
        c["body"] = c.get(body_key) or c.get("content") or ""
        items.append(c)
    return items


@router.get("/{key}")
async def get_content_by_key(key: str, request: Request, lang: str | None = "en"):
    db = await get_db(request)
    content = await db.prepare("SELECT * FROM content WHERE key = ?").bind(key).first()
    if not content:
        raise HTTPException(404, "Content not found")
    content = dict(content)
    if not content.get("is_public"):
        await require_admin_auth(request)
    body_key = f"content_{lang}" if lang else "content_en"
    content["body"] = content.get(body_key) or content.get("content") or ""
    return content


@router.post("", status_code=201)
async def create_content(
    body: ContentBody,
    payload: dict = Depends(require_admin_auth),
    request: Request = None,
):
    db = await get_db(request)
    if not body.key:
        raise HTTPException(400, "Key is required")
    if not (body.content or body.content_en):
        raise HTTPException(400, "Content is required")

    existing = await db.prepare("SELECT id FROM content WHERE key = ?").bind(body.key).first()
    if existing:
        raise HTTPException(400, "Content with this key already exists")

    content_id = str(uuid.uuid4())
    await db.prepare(
        "INSERT INTO content (id, key, title, content, content_en, content_de, content_fr, "
        "content_type, is_public, \"order\", scheduled_publish_at, scheduled_unpublish_at, "
        "updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))"
    ).bind(
        content_id, body.key, body.title,
        body.content or body.content_en or "",
        body.content_en or body.content or "",
        body.content_de or "", body.content_fr or "",
        body.content_type or "html", int(body.is_public if body.is_public is not None else 1),
        body.order or 0,
        body.scheduled_publish_at, body.scheduled_unpublish_at,
    ).run()

    content = await db.prepare("SELECT * FROM content WHERE id = ?").bind(content_id).first()
    return dict(content)


@router.put("/{content_id}")
async def update_content(
    content_id: str,
    body: ContentBody,
    payload: dict = Depends(require_admin_auth),
    request: Request = None,
):
    db = await get_db(request)
    content = await db.prepare("SELECT * FROM content WHERE id = ?").bind(content_id).first()
    if not content:
        raise HTTPException(404, "Content not found")

    updates = []
    binds = []

    if body.key is not None:
        conflict = await db.prepare(
            "SELECT id FROM content WHERE key = ? AND id != ?"
        ).bind(body.key, content_id).first()
        if conflict:
            raise HTTPException(400, "Content with this key already exists")
        updates.append("key = ?"); binds.append(body.key)

    simple = [
        ("title", body.title), ("content", body.content),
        ("content_en", body.content_en), ("content_de", body.content_de),
        ("content_fr", body.content_fr), ("content_type", body.content_type),
        ("\"order\"", body.order),
        ("scheduled_publish_at", body.scheduled_publish_at),
        ("scheduled_unpublish_at", body.scheduled_unpublish_at),
    ]
    for col, val in simple:
        if val is not None:
            updates.append(f"{col} = ?"); binds.append(val)

    if body.is_public is not None:
        updates.append("is_public = ?"); binds.append(int(body.is_public))

    if updates:
        updates.append("updated_at = datetime('now')")
        binds.append(content_id)
        await db.prepare(
            f"UPDATE content SET {', '.join(updates)} WHERE id = ?"
        ).bind(*binds).run()

    updated = await db.prepare("SELECT * FROM content WHERE id = ?").bind(content_id).first()
    return dict(updated)


@router.delete("/{content_id}")
async def delete_content(
    content_id: str,
    payload: dict = Depends(require_admin_auth),
    request: Request = None,
):
    db = await get_db(request)
    content = await db.prepare("SELECT id FROM content WHERE id = ?").bind(content_id).first()
    if not content:
        raise HTTPException(404, "Content not found")
    await db.prepare("DELETE FROM content WHERE id = ?").bind(content_id).run()
    return {"message": "Content deleted successfully"}
