import uuid
from fastapi import APIRouter, Request, Depends, HTTPException
from auth import require_couple_auth
from middleware import get_db

from db import row_to_dict, rows_to_list

router = APIRouter()


@router.get("/status")
async def subscription_status(
    payload: dict = Depends(require_couple_auth),
    request: Request = None,
):
    db = await get_db(request)
    user_id = payload["sub"]
    sub_raw = await db.prepare(
        "SELECT * FROM user_subscriptions WHERE user_id = ?"
    ).bind(user_id).first()
    sub = row_to_dict(sub_raw)
    if not sub:
        return {
            "user_id": user_id,
            "plan": "free",
            "balance_tokens": 0,
            "total_purchased": 0,
            "total_consumed": 0,
        }
    return sub


@router.get("/token-usage")
async def token_usage(
    payload: dict = Depends(require_couple_auth),
    request: Request = None,
):
    db = await get_db(request)
    result = await db.prepare(
        "SELECT * FROM token_usage WHERE user_id = ? ORDER BY created_at DESC LIMIT 50"
    ).bind(payload["sub"]).all()
    return rows_to_list(result)
