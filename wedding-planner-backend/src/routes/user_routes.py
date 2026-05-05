from fastapi import APIRouter, Request, Depends, HTTPException
from auth import require_admin_auth
from middleware import get_db

router = APIRouter()


@router.get("")
async def list_users(
    payload: dict = Depends(require_admin_auth),
    request: Request = None,
):
    db = await get_db(request)
    result = await db.prepare(
        "SELECT id, email, name, role, is_active, current_wedding_id, created_at, updated_at "
        "FROM users ORDER BY created_at DESC"
    ).all()
    return [dict(u) for u in (result.results or [])]


@router.get("/{user_id}")
async def get_user(
    user_id: str,
    payload: dict = Depends(require_admin_auth),
    request: Request = None,
):
    db = await get_db(request)
    user = await db.prepare(
        "SELECT id, email, name, role, is_active, current_wedding_id, created_at, updated_at "
        "FROM users WHERE id = ?"
    ).bind(user_id).first()
    if not user:
        raise HTTPException(404, "User not found")
    return dict(user)


@router.put("/{user_id}")
async def update_user(
    user_id: str,
    payload: dict = Depends(require_admin_auth),
    request: Request = None,
):
    db = await get_db(request)
    from fastapi import Body
    body = await request.json()
    updates, binds = [], []

    for col in ["name", "email", "role"]:
        if col in body:
            updates.append(f"{col} = ?"); binds.append(body[col])
    if "is_active" in body:
        updates.append("is_active = ?"); binds.append(int(body["is_active"]))

    if updates:
        updates.append("updated_at = datetime('now')")
        binds.append(user_id)
        await db.prepare(f"UPDATE users SET {', '.join(updates)} WHERE id = ?").bind(*binds).run()

    user = await db.prepare(
        "SELECT id, email, name, role, is_active, current_wedding_id, created_at, updated_at "
        "FROM users WHERE id = ?"
    ).bind(user_id).first()
    return dict(user)
