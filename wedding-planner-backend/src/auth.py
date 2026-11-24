import logging
import os
import jwt
from datetime import datetime, timedelta, timezone
from fastapi import Request, HTTPException
from db import row_to_dict

logger = logging.getLogger(__name__)

ALGORITHM = "HS256"
TOKEN_EXPIRE_DAYS = 7


def _get_secret() -> str:
    secret = os.environ.get("JWT_SECRET_KEY")
    if not secret:
        raise RuntimeError("JWT_SECRET_KEY not configured")
    return secret


def create_token(user_id: str, wedding_id: str | None = None, role: str = "admin",
                 token_version: int = 0) -> str:
    payload = {
        "sub": user_id,
        "wedding_id": wedding_id,
        "role": role,
        "tv": int(token_version or 0),
        "exp": datetime.now(timezone.utc) + timedelta(days=TOKEN_EXPIRE_DAYS),
    }
    return jwt.encode(payload, _get_secret(), algorithm=ALGORITHM)


def decode_token(token: str) -> dict:
    return jwt.decode(token, _get_secret(), algorithms=[ALGORITHM])


def create_guest_token(guest_id: str, wedding_id: str | None = None) -> str:
    payload = {
        "sub": f"guest_{guest_id}",
        "wedding_id": wedding_id,
        "role": "guest",
        "exp": datetime.now(timezone.utc) + timedelta(days=TOKEN_EXPIRE_DAYS),
    }
    return jwt.encode(payload, _get_secret(), algorithm=ALGORITHM)


async def require_auth(request: Request) -> dict:
    """Dependency: extract and validate JWT from Authorization header."""
    auth = request.headers.get("Authorization", "")
    if not auth.startswith("Bearer "):
        raise HTTPException(401, "Authorization token is missing")
    token = auth[7:]
    try:
        payload = decode_token(token)
        return payload
    except jwt.ExpiredSignatureError:
        raise HTTPException(401, "Token has expired")
    except jwt.InvalidTokenError:
        raise HTTPException(401, "Invalid token")


async def require_couple_auth(request: Request) -> dict:
    """Dependency: require a non-guest (couple) JWT.

    This only rejects guest tokens. It confers NO platform privilege — every
    couple account holds this. For platform-admin authorization use
    ``middleware.require_platform_admin``.
    """
    payload = await require_auth(request)
    sub = payload.get("sub", "")
    if str(sub).startswith("guest_"):
        raise HTTPException(403, "Guest tokens cannot access this resource")
    await _check_session_current(request, payload)
    return payload


async def _check_session_current(request: Request, payload: dict) -> None:
    """Reject a couple token that has been revoked.

    One primary-key lookup per authenticated request: the token's ``tv`` claim
    (absent on tokens issued before this existed = 0) must equal
    ``users.token_version``, and the account must still be active. The version
    is bumped on password reset/change and on deactivation.
    """
    try:
        db = request.scope["env"].DB
        row = await db.prepare(
            "SELECT token_version, is_active FROM users WHERE id = ?"
        ).bind(payload.get("sub")).first()
    except Exception as exc:  # noqa: BLE001
        if "no such column" in str(exc).lower():
            # Migration 009 not applied yet: don't lock every user out.
            logger.error("[auth] users.token_version missing — apply migrations/009; skipping revocation check")
            return
        raise
    if row is None:
        raise HTTPException(401, {"code": "session_revoked", "detail": "Account not found"})
    row = row_to_dict(row)
    if not row.get("is_active", 1):
        raise HTTPException(403, {"code": "account_disabled", "detail": "This account has been disabled"})
    if int(row.get("token_version") or 0) != int(payload.get("tv") or 0):
        raise HTTPException(401, {"code": "session_revoked",
                                  "detail": "Your session has expired. Please sign in again."})
