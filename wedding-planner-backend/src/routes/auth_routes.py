import uuid
import re
import hashlib
import hmac
import os
import base64
import secrets
import time
from datetime import datetime, timedelta, timezone
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

class VerifyEmailBody(BaseModel):
    token: str

class ProfileUpdateBody(BaseModel):
    name: str | None = None
    email: str | None = None
    password: str | None = None

class ResendVerificationBody(BaseModel):
    email: str

class ForgotPasswordBody(BaseModel):
    email: str

class ResetPasswordBody(BaseModel):
    token: str
    password: str
    password_confirmation: str

# ---------- Common weak passwords (OWASP top subset) ----------

_WEAK_PASSWORDS = frozenset([
    "password", "password1", "password123", "12345678", "123456789",
    "1234567890", "qwerty123", "qwertyuiop", "iloveyou", "sunshine",
    "princess", "letmein", "monkey123", "dragon123", "master123",
    "welcome1", "login123", "abc12345", "passw0rd", "p@ssword",
    "mustang1", "shadow123", "superman1", "michael1", "football1",
])

# ---------- In-memory rate limiter (per-IP, per-account) ----------
# Maps key -> list of timestamps; evicted lazily.
_rate_buckets: dict[str, list[float]] = {}

_RATE_LIMIT_WINDOW = 900   # 15 minutes in seconds
_RATE_LIMIT_REGISTER = 5   # max registration attempts per IP per window
_RATE_LIMIT_LOGIN = 10     # max login attempts per IP/account per window

def _rate_check(key: str, limit: int) -> None:
    """Raise 429 if key has exceeded limit within the rolling window."""
    now = time.time()
    cutoff = now - _RATE_LIMIT_WINDOW
    bucket = _rate_buckets.get(key, [])
    bucket = [t for t in bucket if t > cutoff]
    if len(bucket) >= limit:
        retry_after = int(_RATE_LIMIT_WINDOW - (now - bucket[0]))
        raise HTTPException(
            429,
            f"Too many attempts. Please try again in {retry_after // 60 + 1} minutes.",
        )
    bucket.append(now)
    _rate_buckets[key] = bucket

def _get_client_ip(request: Request) -> str:
    cf_ip = request.headers.get("CF-Connecting-IP")
    if cf_ip:
        return cf_ip
    x_forwarded = request.headers.get("X-Forwarded-For")
    if x_forwarded:
        return x_forwarded.split(",")[0].strip()
    return request.client.host if request.client else "unknown"


def _row_to_dict(row) -> dict | None:
    """Normalize Cloudflare D1 rows across dict/JsProxy representations."""
    if row is None:
        return None
    if isinstance(row, dict):
        return row
    to_py = getattr(row, "to_py", None)
    if callable(to_py):
        converted = to_py()
        if isinstance(converted, dict):
            return converted
    try:
        return dict(row)
    except Exception as exc:
        raise HTTPException(500, f"Unexpected DB row format: {type(row).__name__}") from exc

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

_ITERATIONS = 1000  # Low count fits within Cloudflare Workers CPU limits


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
        # Format: "pbkdf2:sha256:<iterations>$<salt_b64>$<key_b64>"
        prefix, salt_b64, key_b64 = hashed.split("$")
        iterations = int(prefix.rsplit(":", 1)[-1])
        salt = base64.b64decode(salt_b64)
        expected = base64.b64decode(key_b64)
        actual = hashlib.pbkdf2_hmac("sha256", password.encode(), salt, iterations)
        return hmac.compare_digest(actual, expected)
    except Exception:
        return False


def _validate_password_strength(password: str) -> list[str]:
    """Return a list of error messages; empty list means the password is acceptable."""
    errors: list[str] = []
    if len(password) < 8:
        errors.append("Password must be at least 8 characters long.")
    if password.lower() in _WEAK_PASSWORDS:
        errors.append("Password is too common. Please choose a stronger password.")
    return errors


# ---------- Routes ----------

@router.post("/login")
async def login(body: LoginBody, request: Request):
    db = await get_db(request)

    ip = _get_client_ip(request)
    email = body.email.strip().lower() if body.email else ""

    if not email or not body.password:
        raise HTTPException(400, "Email and password are required")

    # Rate-limit by IP and by account to prevent brute-force
    _rate_check(f"login:ip:{ip}", _RATE_LIMIT_LOGIN)
    _rate_check(f"login:account:{email}", _RATE_LIMIT_LOGIN)

    user = await db.prepare(
        "SELECT * FROM users WHERE email = ?"
    ).bind(email).first()

    user = _row_to_dict(user)
    if not user or not _check_password(body.password, user.get("password_hash", "")):
        raise HTTPException(401, "Invalid credentials")

    # Block login if email not yet verified (when column exists)
    if user.get("email_verified") == 0:
        raise HTTPException(
            403,
            {
                "error_code": "email_not_verified",
                "message": "Please verify your email address before logging in. "
                           "Check your inbox for the verification link.",
            },
        )

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

    ip = _get_client_ip(request)
    _rate_check(f"register:ip:{ip}", _RATE_LIMIT_REGISTER)

    # Validate required fields
    missing: list[str] = []
    for field in ("email", "password", "password_confirmation",
                  "partner_one_first_name", "partner_two_first_name"):
        if not getattr(body, field, None):
            missing.append(field)
    if missing:
        raise HTTPException(
            400,
            {"message": "Missing required fields", "missing_fields": missing},
        )

    if body.password != body.password_confirmation:
        raise HTTPException(400, "Password confirmation does not match")

    # Password strength check
    pw_errors = _validate_password_strength(body.password)
    if pw_errors:
        raise HTTPException(400, {"message": "Password too weak", "errors": pw_errors})

    email = body.email.strip().lower()
    existing = await db.prepare("SELECT id FROM users WHERE email = ?").bind(email).first()
    if existing:
        raise HTTPException(400, "User already exists")

    partner_one = f"{body.partner_one_first_name.strip()} {body.partner_one_last_name.strip()}".strip()
    partner_two = f"{body.partner_two_first_name.strip()} {body.partner_two_last_name.strip()}".strip()

    # Derive wedding year for the slug; fall back to current year when absent
    year = datetime.now(timezone.utc).year
    if body.wedding_date:
        try:
            year = int(body.wedding_date.split("-")[0])
        except (ValueError, IndexError):
            pass

    user_id = str(uuid.uuid4())
    wedding_id = str(uuid.uuid4())
    password_hash = _hash_password(body.password)
    couple_name = f"{partner_one} & {partner_two}"

    # Generate unique slug before writing
    base_slug = _generate_slug(partner_one, partner_two, year)
    slug = await _ensure_unique_slug(db, base_slug)

    # Write user (email_verified defaults to 0 via schema)
    await db.prepare(
        "INSERT INTO users (id, email, password_hash, name, role, is_active, "
        "current_wedding_id, created_at, updated_at) "
        "VALUES (?, ?, ?, ?, 'admin', 1, ?, datetime('now'), datetime('now'))"
    ).bind(user_id, email, password_hash, couple_name, wedding_id).run()

    # Write wedding
    await db.prepare(
        "INSERT INTO weddings (id, slug, owner_id, partner_one_name, partner_two_name, "
        "wedding_date, location, plan, is_active, created_at, updated_at) "
        "VALUES (?, ?, ?, ?, ?, ?, ?, 'free', 1, datetime('now'), datetime('now'))"
    ).bind(wedding_id, slug, user_id, partner_one, partner_two, body.wedding_date, body.location).run()

    # Create email verification token (64-byte hex = 128 chars)
    verification_token = secrets.token_hex(64)
    expires_at = (datetime.now(timezone.utc) + timedelta(hours=24)).strftime("%Y-%m-%d %H:%M:%S")

    await db.prepare(
        "INSERT INTO email_verifications (id, user_id, token, expires_at, created_at) "
        "VALUES (?, ?, ?, ?, datetime('now'))"
    ).bind(str(uuid.uuid4()), user_id, verification_token, expires_at).run()

    # Send welcome + verification email (non-blocking)
    try:
        from services.email_service import send_welcome_email, send_verification_email
        await send_welcome_email(email, couple_name, slug)
        await send_verification_email(email, couple_name, verification_token)
    except Exception:
        pass

    token = create_token(user_id, wedding_id, "admin")

    return {
        "message": "Couple registered successfully. Please check your email to verify your account.",
        "access_token": token,
        "email_verification_required": True,
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


@router.post("/verify-email")
async def verify_email(body: VerifyEmailBody, request: Request):
    """Consume a verification token and mark the user's email as verified."""
    if not body.token:
        raise HTTPException(400, "Verification token is required")

    db = await get_db(request)

    row = await db.prepare(
        "SELECT * FROM email_verifications WHERE token = ? AND used_at IS NULL"
    ).bind(body.token).first()

    if not row:
        raise HTTPException(400, "Invalid or already-used verification token")

    row = _row_to_dict(row)
    now_utc = datetime.now(timezone.utc)

    # Check expiry
    try:
        expires = datetime.fromisoformat(row["expires_at"]).replace(tzinfo=timezone.utc)
        if now_utc > expires:
            raise HTTPException(400, "Verification token has expired. Please request a new one.")
    except (KeyError, ValueError):
        raise HTTPException(400, "Invalid verification token")

    user_id = row["user_id"]

    # Mark user as verified. Older schemas may not yet have email_verified columns.
    try:
        await db.prepare(
            "UPDATE users SET email_verified = 1, email_verified_at = datetime('now'), "
            "updated_at = datetime('now') WHERE id = ?"
        ).bind(user_id).run()
    except Exception as exc:
        if "no such column: email_verified" not in str(exc):
            raise
        await db.prepare(
            "UPDATE users SET updated_at = datetime('now') WHERE id = ?"
        ).bind(user_id).run()

    # Mark token as used
    await db.prepare(
        "UPDATE email_verifications SET used_at = datetime('now') WHERE id = ?"
    ).bind(row["id"]).run()

    return {"message": "Email verified successfully. You can now log in."}


@router.post("/resend-verification")
async def resend_verification(body: ResendVerificationBody, request: Request):
    """Re-issue a verification token for an unverified account."""
    db = await get_db(request)
    ip = _get_client_ip(request)
    _rate_check(f"resend-verification:ip:{ip}", 3)

    email = body.email.strip().lower() if body.email else ""
    if not email:
        raise HTTPException(400, "Email is required")

    user = await db.prepare("SELECT * FROM users WHERE email = ?").bind(email).first()
    # Always return 200 to avoid email enumeration
    if not user:
        return {"message": "If that email exists and is unverified, a new link has been sent."}

    user = _row_to_dict(user)
    if user.get("email_verified") == 1:
        return {"message": "Email is already verified. You can log in."}

    # Invalidate old tokens
    await db.prepare(
        "UPDATE email_verifications SET used_at = datetime('now') "
        "WHERE user_id = ? AND used_at IS NULL"
    ).bind(user["id"]).run()

    verification_token = secrets.token_hex(64)
    expires_at = (datetime.now(timezone.utc) + timedelta(hours=24)).strftime("%Y-%m-%d %H:%M:%S")
    await db.prepare(
        "INSERT INTO email_verifications (id, user_id, token, expires_at, created_at) "
        "VALUES (?, ?, ?, ?, datetime('now'))"
    ).bind(str(uuid.uuid4()), user["id"], verification_token, expires_at).run()

    try:
        from services.email_service import send_verification_email
        await send_verification_email(email, user.get("name", ""), verification_token)
    except Exception:
        pass

    return {"message": "If that email exists and is unverified, a new link has been sent."}


@router.post("/forgot-password")
async def forgot_password(body: ForgotPasswordBody, request: Request):
    """Generate a password-reset token and email it. Always returns 200."""
    db = await get_db(request)
    ip = _get_client_ip(request)
    _rate_check(f"forgot-password:ip:{ip}", 3)

    email = body.email.strip().lower() if body.email else ""
    if not email:
        raise HTTPException(400, "Email is required")

    user = await db.prepare("SELECT * FROM users WHERE email = ?").bind(email).first()
    if not user:
        return {"message": "If that email is registered, a reset link has been sent."}

    user = _row_to_dict(user)

    # Invalidate existing unused reset tokens for this user
    await db.prepare(
        "UPDATE password_reset_tokens SET used_at = datetime('now') "
        "WHERE user_id = ? AND used_at IS NULL"
    ).bind(user["id"]).run()

    reset_token = secrets.token_hex(64)
    expires_at = (datetime.now(timezone.utc) + timedelta(hours=1)).strftime("%Y-%m-%d %H:%M:%S")
    await db.prepare(
        "INSERT INTO password_reset_tokens (id, user_id, token, expires_at, created_at) "
        "VALUES (?, ?, ?, ?, datetime('now'))"
    ).bind(str(uuid.uuid4()), user["id"], reset_token, expires_at).run()

    try:
        from services.email_service import send_password_reset_email
        sent = await send_password_reset_email(email, user.get("name", ""), reset_token)
        if not sent:
            print(f"[auth] forgot-password email delivery failed for {email}")
    except Exception:
        pass

    return {"message": "If that email is registered, a reset link has been sent."}


@router.post("/reset-password")
async def reset_password(body: ResetPasswordBody, request: Request):
    """Consume a password-reset token and set the new password."""
    if not body.token:
        raise HTTPException(400, "Reset token is required")
    if body.password != body.password_confirmation:
        raise HTTPException(400, "Password confirmation does not match")

    pw_errors = _validate_password_strength(body.password)
    if pw_errors:
        raise HTTPException(400, {"message": "Password too weak", "errors": pw_errors})

    db = await get_db(request)

    row = await db.prepare(
        "SELECT * FROM password_reset_tokens WHERE token = ? AND used_at IS NULL"
    ).bind(body.token).first()

    if not row:
        raise HTTPException(400, "Invalid or already-used reset token")

    row = _row_to_dict(row)
    now_utc = datetime.now(timezone.utc)
    try:
        expires = datetime.fromisoformat(row["expires_at"]).replace(tzinfo=timezone.utc)
        if now_utc > expires:
            raise HTTPException(400, "Reset token has expired. Please request a new one.")
    except (KeyError, ValueError):
        raise HTTPException(400, "Invalid reset token")

    user_id = row["user_id"]
    try:
        await db.prepare(
            "UPDATE users SET password_hash = ?, email_verified = 1, "
            "updated_at = datetime('now') WHERE id = ?"
        ).bind(_hash_password(body.password), user_id).run()
    except Exception as exc:
        if "no such column: email_verified" not in str(exc):
            raise
        # Backward compatibility for older users schema.
        await db.prepare(
            "UPDATE users SET password_hash = ?, updated_at = datetime('now') WHERE id = ?"
        ).bind(_hash_password(body.password), user_id).run()

    await db.prepare(
        "UPDATE password_reset_tokens SET used_at = datetime('now') WHERE id = ?"
    ).bind(row["id"]).run()

    return {"message": "Password reset successfully. You can now log in."}


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
    user = _row_to_dict(user)
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
        pw_errors = _validate_password_strength(body.password)
        if pw_errors:
            raise HTTPException(400, {"message": "Password too weak", "errors": pw_errors})
        await db.prepare(
            "UPDATE users SET password_hash = ?, updated_at = datetime('now') WHERE id = ?"
        ).bind(_hash_password(body.password), user_id).run()

    user = await db.prepare("SELECT * FROM users WHERE id = ?").bind(user_id).first()
    user = _row_to_dict(user)
    return {
        "id": user["id"],
        "email": user["email"],
        "name": user["name"],
        "role": user["role"],
    }
