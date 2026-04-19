import uuid
from fastapi import APIRouter, Request, Depends, HTTPException
from src.auth import require_admin_auth
from src.middleware import get_db

router = APIRouter()


@router.get("/status")
async def subscription_status(
    payload: dict = Depends(require_admin_auth),
    request: Request = None,
):
    db = await get_db(request)
    user_id = payload["sub"]
    sub = await db.prepare(
        "SELECT * FROM user_subscriptions WHERE user_id = ?"
    ).bind(user_id).first()
    if not sub:
        return {
            "user_id": user_id,
            "plan": "free",
            "balance_tokens": 0,
            "total_purchased": 0,
            "total_consumed": 0,
        }
    return dict(sub)


@router.get("/token-usage")
async def token_usage(
    payload: dict = Depends(require_admin_auth),
    request: Request = None,
):
    db = await get_db(request)
    result = await db.prepare(
        "SELECT * FROM token_usage WHERE user_id = ? ORDER BY created_at DESC LIMIT 50"
    ).bind(payload["sub"]).all()
    return [dict(u) for u in (result.results or [])]
