import uuid
import re
import hashlib
import hmac
import os
import base64
from fastapi import APIRouter, Request, Depends, HTTPException
from pydantic import BaseModel
from auth import create_token, create_guest_token, require_admin_auth, decode_token
from middleware import get_db

router = APIRouter()

# ---------- Pydantic models ----------

class LoginBody(BaseModel):
    email: str
    password: str

class RegisterBody(BaseModel):
    email: str
    password: str
    password_confirmation: str
    partner_one_first_name: str
    partner_one_last_name: str
    partner_two_first_name: str
    partner_two_last_name: str
    wedding_date: str | None = None
    location: str | None = None
    style_notes: str | None = None

class ProfileUpdateBody(BaseModel):
    name: str | None = None
    email: str | None = None
    password: str | None = None

# ---------- Helpers ----------

def _generate_slug(p1: str, p2: str, year: int) -> str:
    def _s(name: str) -> str:
        name = name.lower().strip()
        name = re.sub(r"[^a-z0-9\s-]", "", name)
        name = re.sub(r"\s+", "-", name)
        return name.strip("-")
    first1 = _s(p1.split()[0] if p1 else "partner1")
    first2 = _s(p2.split()[0] if p2 else "partner2")
    return f"{first1}-and-{first2}-{year}"

async def _ensure_unique_slug(db, base_slug: str) -> str:
    slug = base_slug
    counter = 1
    while True:
        row = await db.prepare("SELECT id FROM weddings WHERE slug = ?").bind(slug).first()
        if not row:
            return slug
        slug = f"{base_slug}-{counter}"
        counter += 1

_ITERATIONS = 260000

def _hash_password(password: str) -> str:
    salt = os.urandom(32)
    key = hashlib.pbkdf2_hmac("sha256", password.encode(), salt, _ITERATIONS)
    return "pbkdf2:sha256:{}${}${}".format(
        _ITERATIONS,
        base64.b64encode(salt).decode(),
        base64.b64encode(key).decode(),
    )

def _check_password(password: str, hashed: str) -> bool:
    try:
        _, params, salt_b64, key_b64 = hashed.split("$")
        iterations = int(params.split(":")[-1])
        salt = base64.b64decode(salt_b64)
        expected = base64.b64decode(key_b64)
        actual = hashlib.pbkdf2_hmac("sha256", password.encode(), salt, iterations)
        return hmac.compare_digest(actual, expected)
    except Exception:
        return False


# ---------- Routes ----------

@router.post("/login")
async def login(body: LoginBody, request: Request):
    db = await get_db(request)

    if not body.email or not body.password:
        raise HTTPException(400, "Email and password are required")

    user = await db.prepare(
        "SELECT * FROM users WHERE email = ?"
    ).bind(body.email.strip().lower()).first()

    if not user or not _check_password(body.password, user["password_hash"]):
        raise HTTPException(401, "Invalid credentials")

    user = dict(user)
    token = create_token(user["id"], user.get("current_wedding_id"), user.get("role", "admin"))
    return {
        "access_token": token,
        "user": {
            "id": user["id"],
            "email": user["email"],
            "name": user["name"],
            "role": user["role"],
            "is_active": bool(user["is_active"]),
            "current_wedding_id": user.get("current_wedding_id"),
            "created_at": user.get("created_at"),
            "updated_at": user.get("updated_at"),
        },
    }


@router.post("/couple/register", status_code=201)
async def register_couple(body: RegisterBody, request: Request):
    """Public registration: creates user + wedding atomically."""
    db = await get_db(request)

    if body.password != body.password_confirmation:
        raise HTTPException(400, "Password confirmation does not match")

    email = body.email.strip().lower()
    existing = await db.prepare("SELECT id FROM users WHERE email = ?").bind(email).first()
    if existing:
        raise HTTPException(400, "User already exists")

    partner_one = f"{body.partner_one_first_name.strip()} {body.partner_one_last_name.strip()}".strip()
    partner_two = f"{body.partner_two_first_name.strip()} {body.partner_two_last_name.strip()}".strip()

    # Parse wedding year for slug
    year = 2026
    if body.wedding_date:
        try:
            year = int(body.wedding_date.split("-")[0])
        except (ValueError, IndexError):
            pass

    user_id = str(uuid.uuid4())
    wedding_id = str(uuid.uuid4())
    password_hash = _hash_password(body.password)
    couple_name = f"{partner_one} & {partner_two}"

    # Generate unique slug before batch
    base_slug = _generate_slug(partner_one, partner_two, year)
    slug = await _ensure_unique_slug(db, base_slug)

    # Atomically create user (with wedding link) + wedding in one batch
    await db.batch([
        db.prepare(
            "INSERT INTO users (id, email, password_hash, name, role, is_active, "
            "current_wedding_id, created_at, updated_at) "
            "VALUES (?, ?, ?, ?, 'admin', 1, ?, datetime('now'), datetime('now'))"
        ).bind(user_id, email, password_hash, couple_name, wedding_id),
        db.prepare(
            "INSERT INTO weddings (id, slug, owner_id, partner_one_name, partner_two_name, "
            "wedding_date, location, plan, is_active, created_at, updated_at) "
            "VALUES (?, ?, ?, ?, ?, ?, ?, 'free', 1, datetime('now'), datetime('now'))"
        ).bind(wedding_id, slug, user_id, partner_one, partner_two, body.wedding_date, body.location),
    ])

    token = create_token(user_id, wedding_id, "admin")

    # 5. Send welcome email (non-blocking)
    try:
        from services.email_service import send_welcome_email
        await send_welcome_email(email, couple_name, slug)
    except Exception:
        pass

    return {
        "message": "Couple registered successfully",
        "access_token": token,
        "user": {
            "id": user_id,
            "email": email,
            "name": couple_name,
            "role": "admin",
            "current_wedding_id": wedding_id,
        },
        "wedding": {
            "id": wedding_id,
            "slug": slug,
            "partner_one_name": partner_one,
            "partner_two_name": partner_two,
            "wedding_date": body.wedding_date,
            "plan": "free",
        },
    }


@router.post("/register", status_code=201)
async def register(body: LoginBody, request: Request):
    """Admin-only registration (disabled by default)."""
    import os
    if not os.environ.get("ALLOW_ADMIN_REGISTRATION", "").lower() in ("1", "true", "yes"):
        raise HTTPException(403, "Admin registration is disabled")

    db = await get_db(request)
    email = body.email.strip().lower()
    existing = await db.prepare("SELECT id FROM users WHERE email = ?").bind(email).first()
    if existing:
        raise HTTPException(400, "User already exists")

    user_id = str(uuid.uuid4())
    password_hash = _hash_password(body.password)
    name = email.split("@")[0]
    await db.prepare(
        "INSERT INTO users (id, email, password_hash, name, role, is_active, created_at, updated_at) "
        "VALUES (?, ?, ?, ?, 'admin', 1, datetime('now'), datetime('now'))"
    ).bind(user_id, email, password_hash, name).run()

    return {"message": "User created successfully", "user": {"id": user_id, "email": email}}


@router.get("/profile")
async def get_profile(payload: dict = Depends(require_admin_auth), request: Request = None):
    db = await get_db(request)
    user = await db.prepare("SELECT * FROM users WHERE id = ?").bind(payload["sub"]).first()
    if not user:
        raise HTTPException(404, "User not found")
    user = dict(user)
    return {
        "id": user["id"],
        "email": user["email"],
        "name": user["name"],
        "role": user["role"],
        "is_active": bool(user["is_active"]),
        "current_wedding_id": user.get("current_wedding_id"),
        "created_at": user.get("created_at"),
        "updated_at": user.get("updated_at"),
    }


@router.put("/profile")
async def update_profile(
    body: ProfileUpdateBody,
    payload: dict = Depends(require_admin_auth),
    request: Request = None,
):
    db = await get_db(request)
    user_id = payload["sub"]

    if body.email:
        conflict = await db.prepare(
            "SELECT id FROM users WHERE email = ? AND id != ?"
        ).bind(body.email.strip().lower(), user_id).first()
        if conflict:
            raise HTTPException(400, "Email already in use")
        await db.prepare(
            "UPDATE users SET email = ?, updated_at = datetime('now') WHERE id = ?"
        ).bind(body.email.strip().lower(), user_id).run()

    if body.name:
        await db.prepare(
            "UPDATE users SET name = ?, updated_at = datetime('now') WHERE id = ?"
        ).bind(body.name, user_id).run()

    if body.password:
        await db.prepare(
            "UPDATE users SET password_hash = ?, updated_at = datetime('now') WHERE id = ?"
        ).bind(_hash_password(body.password), user_id).run()

    user = await db.prepare("SELECT * FROM users WHERE id = ?").bind(user_id).first()
    user = dict(user)
    return {
        "id": user["id"],
        "email": user["email"],
        "name": user["name"],
        "role": user["role"],
    }
