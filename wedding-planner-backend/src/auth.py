import os
import jwt
from datetime import datetime, timedelta, timezone
from fastapi import Request, HTTPException

ALGORITHM = "HS256"
TOKEN_EXPIRE_DAYS = 7


def _get_secret() -> str:
    return os.environ.get("JWT_SECRET_KEY", "dev-secret-change-in-production")


def create_token(user_id: str, wedding_id: str | None = None, role: str = "admin") -> str:
    payload = {
        "sub": user_id,
        "wedding_id": wedding_id,
        "role": role,
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


async def require_admin_auth(request: Request) -> dict:
    """Dependency: require a non-guest JWT."""
    payload = await require_auth(request)
    sub = payload.get("sub", "")
    if str(sub).startswith("guest_"):
        raise HTTPException(403, "Guest tokens cannot access this resource")
    return payload
