"""Moodboards — wedding-scoped canvases shared by both partners.

Mounted at ``/api/moodboards`` (see main.py). Contract:

  GET    /                  -> [{id, title, updated_at}]
  POST   /        {title}   -> board            (201)
  POST   /reset             -> board            (deletes ALL boards of the wedding,
                                                 recreates one "Main Moodboard")
  GET    /{id}              -> {id, title, content_json}
  PATCH  /{id}    {title?}  -> board            (rename only — never touches content)
  PUT    /{id}/content {content_json}
                            -> {id, updated_at} (replaces the whole canvas atomically;
                                                 413 above ~1 MB)
  DELETE /{id}

Tenancy comes from the wedding resolved by ``require_feature("moodboard")``
(403 ``upgrade_required`` on the free plan); every by-id query is
``AND wedding_id = ?`` so another wedding's board is a 404.
"""
import json
import uuid

from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel

from auth import require_couple_auth
from db import row_to_dict, rows_to_list
from entitlements import require_feature
from middleware import get_db

_gate = require_feature("moodboard")

router = APIRouter()

MAX_CONTENT_BYTES = 1_000_000  # ~1 MB cap on a board's serialized content
DEFAULT_TITLE = "Main Moodboard"


class CreateBody(BaseModel):
    title: str


class RenameBody(BaseModel):
    title: str | None = None


class ContentBody(BaseModel):
    # An object, or a JSON string (older clients stringified before sending).
    content_json: dict | str


def _clean_title(title: str | None) -> str:
    t = (title or "").strip()
    if not t:
        raise HTTPException(400, {"code": "invalid_title", "detail": "Title is required"})
    return t[:200]


def _parse_content(raw) -> dict:
    """Parse stored content_json text to an object ({} when empty/corrupt)."""
    if not raw:
        return {}
    try:
        val = json.loads(raw)
    except (TypeError, ValueError):
        return {}
    return val if isinstance(val, dict) else {}


def _board(row: dict) -> dict:
    return {
        "id": row["id"],
        "title": row["title"],
        "updated_at": row.get("updated_at"),
        "content_json": _parse_content(row.get("content_json")),
    }


_COLS = "id, name AS title, content_json, created_at, updated_at"


async def _get_owned(db, board_id: str, wedding_id: str) -> dict:
    row = await db.prepare(
        f"SELECT {_COLS} FROM moodboards WHERE id = ? AND wedding_id = ?"
    ).bind(board_id, wedding_id).first()
    row = row_to_dict(row)
    if not row:
        raise HTTPException(404, "Moodboard not found")
    return row


@router.get("")
async def list_moodboards(
    wedding: dict = Depends(_gate),
    request: Request = None,
):
    db = await get_db(request)
    result = await db.prepare(
        "SELECT id, name AS title, updated_at FROM moodboards "
        "WHERE wedding_id = ? ORDER BY created_at ASC, id ASC"
    ).bind(wedding["id"]).all()
    return rows_to_list(result)


@router.post("", status_code=201)
async def create_moodboard(
    body: CreateBody,
    wedding: dict = Depends(_gate),
    payload: dict = Depends(require_couple_auth),
    request: Request = None,
):
    db = await get_db(request)
    title = _clean_title(body.title)
    mid = str(uuid.uuid4())
    await db.prepare(
        "INSERT INTO moodboards (id, wedding_id, user_id, name, content_json, created_at, updated_at) "
        "VALUES (?, ?, ?, ?, '{}', datetime('now'), datetime('now'))"
    ).bind(mid, wedding["id"], payload["sub"], title).run()
    return _board(await _get_owned(db, mid, wedding["id"]))


@router.post("/reset", status_code=201)
async def reset_moodboards(
    wedding: dict = Depends(_gate),
    payload: dict = Depends(require_couple_auth),
    request: Request = None,
):
    """Delete every board of this wedding and recreate a single default one."""
    db = await get_db(request)
    wid = wedding["id"]
    mid = str(uuid.uuid4())
    await db.batch([
        db.prepare(
            "DELETE FROM moodboard_elements WHERE moodboard_id IN "
            "(SELECT id FROM moodboards WHERE wedding_id = ?)"
        ).bind(wid),
        db.prepare("DELETE FROM moodboards WHERE wedding_id = ?").bind(wid),
        db.prepare(
            "INSERT INTO moodboards (id, wedding_id, user_id, name, content_json, created_at, updated_at) "
            "VALUES (?, ?, ?, ?, '{}', datetime('now'), datetime('now'))"
        ).bind(mid, wid, payload["sub"], DEFAULT_TITLE),
    ])
    return _board(await _get_owned(db, mid, wid))


@router.get("/{moodboard_id}")
async def get_moodboard(
    moodboard_id: str,
    wedding: dict = Depends(_gate),
    request: Request = None,
):
    db = await get_db(request)
    row = await _get_owned(db, moodboard_id, wedding["id"])
    return {"id": row["id"], "title": row["title"], "content_json": _parse_content(row["content_json"])}


@router.patch("/{moodboard_id}")
async def rename_moodboard(
    moodboard_id: str,
    body: RenameBody,
    wedding: dict = Depends(_gate),
    request: Request = None,
):
    """Rename only. Deliberately has no access to content_json."""
    db = await get_db(request)
    row = await _get_owned(db, moodboard_id, wedding["id"])
    if body.title is not None:
        await db.prepare(
            "UPDATE moodboards SET name = ?, updated_at = datetime('now') "
            "WHERE id = ? AND wedding_id = ?"
        ).bind(_clean_title(body.title), moodboard_id, wedding["id"]).run()
        row = await _get_owned(db, moodboard_id, wedding["id"])
    return _board(row)


@router.put("/{moodboard_id}/content")
async def save_moodboard_content(
    moodboard_id: str,
    body: ContentBody,
    wedding: dict = Depends(_gate),
    request: Request = None,
):
    """Replace the board's whole canvas in one statement (atomic)."""
    db = await get_db(request)
    content = body.content_json
    if isinstance(content, str):
        try:
            content = json.loads(content)
        except ValueError:
            raise HTTPException(400, {"code": "invalid_content", "detail": "content_json is not valid JSON"})
        if not isinstance(content, dict):
            raise HTTPException(400, {"code": "invalid_content", "detail": "content_json must be a JSON object"})
    text = json.dumps(content, separators=(",", ":"))
    if len(text.encode("utf-8")) > MAX_CONTENT_BYTES:
        raise HTTPException(
            413,
            {"code": "payload_too_large", "detail": "Moodboard is too large to save (limit about 1 MB)"},
        )

    await _get_owned(db, moodboard_id, wedding["id"])  # 404 for another wedding's board
    await db.prepare(
        "UPDATE moodboards SET content_json = ?, updated_at = datetime('now') "
        "WHERE id = ? AND wedding_id = ?"
    ).bind(text, moodboard_id, wedding["id"]).run()
    row = await _get_owned(db, moodboard_id, wedding["id"])
    return {"id": row["id"], "updated_at": row["updated_at"]}


@router.delete("/{moodboard_id}")
async def delete_moodboard(
    moodboard_id: str,
    wedding: dict = Depends(_gate),
    request: Request = None,
):
    db = await get_db(request)
    await _get_owned(db, moodboard_id, wedding["id"])
    await db.batch([
        db.prepare("DELETE FROM moodboard_elements WHERE moodboard_id = ?").bind(moodboard_id),
        db.prepare("DELETE FROM moodboards WHERE id = ? AND wedding_id = ?").bind(moodboard_id, wedding["id"]),
    ])
    return {"message": "Moodboard deleted"}
