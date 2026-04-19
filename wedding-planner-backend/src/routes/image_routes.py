import uuid
from fastapi import APIRouter, Request, Depends, HTTPException
from pydantic import BaseModel
from src.auth import require_admin_auth
from src.middleware import get_db

router = APIRouter()


class ImageBody(BaseModel):
    file_url: str
    filename: str | None = None
    original_filename: str | None = None
    mime_type: str | None = None
    size: int | None = None
    category: str | None = None
    is_public: bool | None = False


@router.get("/api/images")
async def list_images(
    payload: dict = Depends(require_admin_auth),
    request: Request = None,
):
    db = await get_db(request)
    result = await db.prepare("SELECT * FROM images ORDER BY created_at DESC").all()
    return [dict(i) for i in (result.results or [])]


@router.post("/api/images", status_code=201)
async def create_image(
    body: ImageBody,
    payload: dict = Depends(require_admin_auth),
    request: Request = None,
):
    db = await get_db(request)
    img_id = str(uuid.uuid4())
    await db.prepare(
        "INSERT INTO images (id, filename, original_filename, file_url, mime_type, size, "
        "category, is_public, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))"
    ).bind(
        img_id, body.filename or body.original_filename, body.original_filename,
        body.file_url, body.mime_type, body.size, body.category, int(body.is_public or 0),
    ).run()
    img = await db.prepare("SELECT * FROM images WHERE id = ?").bind(img_id).first()
    return dict(img)


@router.delete("/api/images/{image_id}")
async def delete_image(
    image_id: str,
    payload: dict = Depends(require_admin_auth),
    request: Request = None,
):
    db = await get_db(request)
    await db.prepare("DELETE FROM images WHERE id = ?").bind(image_id).run()
    return {"message": "Image deleted"}
