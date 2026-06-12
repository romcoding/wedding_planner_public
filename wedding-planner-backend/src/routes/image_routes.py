import uuid
from fastapi import APIRouter, Request, Depends, HTTPException
from pydantic import BaseModel
from middleware import get_db, get_wedding

from db import row_to_dict, rows_to_list

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
    wedding: dict = Depends(get_wedding),
    request: Request = None,
):
    db = await get_db(request)
    result = await db.prepare(
        "SELECT * FROM images WHERE wedding_id = ? ORDER BY created_at DESC"
    ).bind(wedding["id"]).all()
    return rows_to_list(result)


@router.post("/api/images", status_code=201)
async def create_image(
    body: ImageBody,
    wedding: dict = Depends(get_wedding),
    request: Request = None,
):
    db = await get_db(request)
    img_id = str(uuid.uuid4())
    await db.prepare(
        "INSERT INTO images (id, wedding_id, filename, original_filename, file_url, mime_type, size, "
        "category, is_public, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))"
    ).bind(
        img_id, wedding["id"], body.filename or body.original_filename, body.original_filename,
        body.file_url, body.mime_type, body.size, body.category, int(body.is_public or 0),
    ).run()
    img = await db.prepare(
        "SELECT * FROM images WHERE id = ? AND wedding_id = ?"
    ).bind(img_id, wedding["id"]).first()
    if not img:
        raise HTTPException(500, "Failed to create image")
    return row_to_dict(img)


@router.delete("/api/images/{image_id}")
async def delete_image(
    image_id: str,
    wedding: dict = Depends(get_wedding),
    request: Request = None,
):
    db = await get_db(request)
    img = await db.prepare(
        "SELECT id FROM images WHERE id = ? AND wedding_id = ?"
    ).bind(image_id, wedding["id"]).first()
    if not img:
        raise HTTPException(404, "Image not found")
    await db.prepare(
        "DELETE FROM images WHERE id = ? AND wedding_id = ?"
    ).bind(image_id, wedding["id"]).run()
    return {"message": "Image deleted"}
