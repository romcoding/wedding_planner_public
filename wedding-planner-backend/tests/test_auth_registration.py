"""
Unit tests for auth_routes.py registration, email-verification, and rate-limiting logic.

These tests exercise the route-handler business logic directly by mocking the
Cloudflare D1 database interface so no Workers runtime is required.
"""
import asyncio
import importlib
import sys
import types
import uuid
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

# ---------------------------------------------------------------------------
# Stub out Cloudflare-Workers-only modules before importing our route module.
# ---------------------------------------------------------------------------

def _make_stub(name):
    mod = types.ModuleType(name)
    sys.modules[name] = mod
    return mod

for _name in ("workers", "asgi", "js"):
    if _name not in sys.modules:
        _make_stub(_name)

# Stub 'auth' module (create_token etc.) ─ lives at src/ level
if "auth" not in sys.modules:
    auth_stub = _make_stub("auth")
    auth_stub.create_token = lambda user_id, wedding_id, role: f"token:{user_id}"
    auth_stub.require_admin_auth = None
    auth_stub.decode_token = lambda t: {}
    auth_stub.create_guest_token = lambda *a, **kw: "guest_token"

# Stub 'middleware' module
if "middleware" not in sys.modules:
    mw_stub = _make_stub("middleware")
    mw_stub.get_db = AsyncMock()

# Stub 'services.email_service'
services_stub = _make_stub("services")
email_stub = _make_stub("services.email_service")
email_stub.send_welcome_email = AsyncMock(return_value=None)
email_stub.send_verification_email = AsyncMock(return_value=None)
services_stub.email_service = email_stub

# ---------------------------------------------------------------------------
# Import the module under test
# ---------------------------------------------------------------------------

# Add src/ to path so relative imports work
import os
_SRC = os.path.join(os.path.dirname(__file__), "..", "src")
if _SRC not in sys.path:
    sys.path.insert(0, os.path.abspath(_SRC))

from routes.auth_routes import (  # noqa: E402
    RegisterBody,
    VerifyEmailBody,
    _hash_password,
    _check_password,
    _validate_password_strength,
    _rate_check,
    _rate_buckets,
    register_couple,
    verify_email,
    login,
)

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def run(coro):
    """Run a coroutine synchronously (Python < 3.11 compatible)."""
    return asyncio.get_event_loop().run_until_complete(coro)


class FakeRow(dict):
    """Behaves like a D1 row (dict-like access)."""


class FakeDB:
    """Minimal D1-like fake that records INSERT/UPDATE calls."""

    def __init__(self):
        self.tables: dict[str, list[dict]] = {
            "users": [],
            "weddings": [],
            "email_verifications": [],
        }
        self._select_results: dict[str, list] = {}

    def _add_result(self, pattern: str, rows: list):
        """Register a canned result for a query matching *pattern*."""
        self._select_results[pattern] = rows

    def prepare(self, sql: str):
        return _PreparedStmt(sql, self)


class _PreparedStmt:
    def __init__(self, sql: str, db: FakeDB):
        self._sql = sql.upper()
        self._db = db
        self._bindings: list = []

    def bind(self, *args):
        self._bindings = list(args)
        return self

    async def first(self):
        for pattern, rows in self._db._select_results.items():
            if pattern.upper() in self._sql:
                return rows[0] if rows else None
        return None

    async def run(self):
        # Record inserts for assertion
        if "INSERT INTO USERS" in self._sql:
            self._db.tables["users"].append({"bindings": self._bindings})
        elif "INSERT INTO WEDDINGS" in self._sql:
            self._db.tables["weddings"].append({"bindings": self._bindings})
        elif "INSERT INTO EMAIL_VERIFICATIONS" in self._sql:
            self._db.tables["email_verifications"].append({"bindings": self._bindings})
        elif "UPDATE USERS" in self._sql:
            pass  # accept silently
        elif "UPDATE EMAIL_VERIFICATIONS" in self._sql:
            pass


def _make_request(db: FakeDB):
    """Return a minimal FastAPI-like request stub with the fake DB attached."""
    req = MagicMock()
    req.headers.get = MagicMock(return_value=None)
    req.client.host = "127.0.0.1"

    import middleware
    middleware.get_db = AsyncMock(return_value=db)
    return req


# ---------------------------------------------------------------------------
# Password helper tests
# ---------------------------------------------------------------------------

def test_hash_and_check_roundtrip():
    pw = "MySecureP@ss1"
    assert _check_password(pw, _hash_password(pw))


def test_check_password_rejects_wrong():
    assert not _check_password("wrong", _hash_password("correct"))


def test_validate_password_strength_too_short():
    errors = _validate_password_strength("abc")
    assert any("8 characters" in e for e in errors)


def test_validate_password_strength_common():
    errors = _validate_password_strength("password123")
    assert any("common" in e.lower() for e in errors)


def test_validate_password_strength_ok():
    assert _validate_password_strength("Tr0ub4dor&3") == []


# ---------------------------------------------------------------------------
# Rate-limiter tests
# ---------------------------------------------------------------------------

def test_rate_check_allows_under_limit():
    key = f"test:ratelimit:{uuid.uuid4()}"
    for _ in range(3):
        _rate_check(key, 5)  # should not raise


def test_rate_check_blocks_over_limit():
    from fastapi import HTTPException as FastHTTPException
    key = f"test:ratelimit:{uuid.uuid4()}"
    for _ in range(5):
        _rate_check(key, 5)
    with pytest.raises(FastHTTPException) as exc_info:
        _rate_check(key, 5)
    assert exc_info.value.status_code == 429


def test_rate_check_different_keys_are_independent():
    key_a = f"test:independent:a:{uuid.uuid4()}"
    key_b = f"test:independent:b:{uuid.uuid4()}"
    for _ in range(5):
        _rate_check(key_a, 5)
    # key_b has never been used, so this should be fine
    _rate_check(key_b, 5)


# ---------------------------------------------------------------------------
# register_couple tests
# ---------------------------------------------------------------------------

BASE_PAYLOAD = dict(
    email="couple@example.com",
    password="Str0ng!Pass",
    password_confirmation="Str0ng!Pass",
    partner_one_first_name="Alice",
    partner_one_last_name="Smith",
    partner_two_first_name="Bob",
    partner_two_last_name="Jones",
)


def _make_body(**overrides):
    data = {**BASE_PAYLOAD, **overrides}
    return RegisterBody(**data)


def test_register_couple_without_wedding_date_succeeds():
    """Registration must succeed when wedding_date is absent."""
    db = FakeDB()
    req = _make_request(db)
    body = _make_body(wedding_date=None)

    result = run(register_couple(body, req))

    assert result["user"]["email"] == "couple@example.com"
    assert len(db.tables["users"]) == 1
    assert len(db.tables["weddings"]) == 1
    assert len(db.tables["email_verifications"]) == 1
    # Slug should use current year (not crash)
    assert "alice-and-bob" in result["wedding"]["slug"]


def test_register_couple_with_wedding_date_uses_year_in_slug():
    db = FakeDB()
    req = _make_request(db)
    body = _make_body(wedding_date="2027-06-15")

    result = run(register_couple(body, req))

    assert "2027" in result["wedding"]["slug"]


def test_register_couple_password_too_short_raises_400():
    from fastapi import HTTPException as FastHTTPException
    db = FakeDB()
    req = _make_request(db)
    body = _make_body(password="short", password_confirmation="short")

    with pytest.raises(FastHTTPException) as exc:
        run(register_couple(body, req))
    assert exc.value.status_code == 400
    # No user/wedding records should have been written
    assert len(db.tables["users"]) == 0
    assert len(db.tables["weddings"]) == 0


def test_register_couple_common_password_raises_400():
    from fastapi import HTTPException as FastHTTPException
    db = FakeDB()
    req = _make_request(db)
    body = _make_body(password="password123", password_confirmation="password123")

    with pytest.raises(FastHTTPException) as exc:
        run(register_couple(body, req))
    assert exc.value.status_code == 400


def test_register_couple_password_mismatch_raises_400():
    from fastapi import HTTPException as FastHTTPException
    db = FakeDB()
    req = _make_request(db)
    body = _make_body(password_confirmation="DifferentPass!1")

    with pytest.raises(FastHTTPException) as exc:
        run(register_couple(body, req))
    assert exc.value.status_code == 400


def test_register_couple_existing_email_raises_400():
    from fastapi import HTTPException as FastHTTPException
    db = FakeDB()
    # Simulate existing user
    db._add_result("SELECT ID FROM USERS WHERE EMAIL", [FakeRow(id="existing-id")])
    req = _make_request(db)
    body = _make_body()

    with pytest.raises(FastHTTPException) as exc:
        run(register_couple(body, req))
    assert exc.value.status_code == 400
    assert len(db.tables["users"]) == 0


def test_register_couple_creates_verification_token():
    db = FakeDB()
    req = _make_request(db)
    body = _make_body()

    result = run(register_couple(body, req))

    assert result["email_verification_required"] is True
    assert len(db.tables["email_verifications"]) == 1
    token_bindings = db.tables["email_verifications"][0]["bindings"]
    # bindings: (id, user_id, token, expires_at)
    assert len(token_bindings[2]) == 128  # 64-byte hex token


# ---------------------------------------------------------------------------
# verify_email tests
# ---------------------------------------------------------------------------

def _verification_row(user_id="uid-1", token="abc" * 43, expired=False, used=False):
    from datetime import datetime, timezone, timedelta
    if expired:
        expires = (datetime.now(timezone.utc) - timedelta(hours=1)).strftime("%Y-%m-%d %H:%M:%S")
    else:
        expires = (datetime.now(timezone.utc) + timedelta(hours=23)).strftime("%Y-%m-%d %H:%M:%S")
    return FakeRow(
        id="verif-id-1",
        user_id=user_id,
        token=token,
        expires_at=expires,
        used_at="2026-01-01 00:00:00" if used else None,
    )


def test_verify_email_valid_token_succeeds():
    db = FakeDB()
    row = _verification_row()
    db._add_result("SELECT * FROM EMAIL_VERIFICATIONS WHERE TOKEN", [row])
    req = _make_request(db)

    result = run(verify_email(VerifyEmailBody(token=row["token"]), req))

    assert "verified" in result["message"].lower()


def test_verify_email_expired_token_raises_400():
    from fastapi import HTTPException as FastHTTPException
    db = FakeDB()
    row = _verification_row(expired=True)
    db._add_result("SELECT * FROM EMAIL_VERIFICATIONS WHERE TOKEN", [row])
    req = _make_request(db)

    with pytest.raises(FastHTTPException) as exc:
        run(verify_email(VerifyEmailBody(token=row["token"]), req))
    assert exc.value.status_code == 400
    assert "expired" in str(exc.value.detail).lower()


def test_verify_email_unknown_token_raises_400():
    from fastapi import HTTPException as FastHTTPException
    db = FakeDB()
    # No result for query → first() returns None
    req = _make_request(db)

    with pytest.raises(FastHTTPException) as exc:
        run(verify_email(VerifyEmailBody(token="nonexistent"), req))
    assert exc.value.status_code == 400


# ---------------------------------------------------------------------------
# login – unverified account must be rejected
# ---------------------------------------------------------------------------

def test_login_unverified_account_raises_403():
    from fastapi import HTTPException as FastHTTPException
    db = FakeDB()
    pw = "Str0ng!Pass"
    user_row = FakeRow(
        id="uid-1",
        email="couple@example.com",
        password_hash=_hash_password(pw),
        name="Alice & Bob",
        role="admin",
        is_active=1,
        email_verified=0,          # ← not verified
        current_wedding_id="wid-1",
    )
    db._add_result("SELECT * FROM USERS WHERE EMAIL", [user_row])
    req = _make_request(db)

    from routes.auth_routes import LoginBody
    body = LoginBody(email="couple@example.com", password=pw)

    with pytest.raises(FastHTTPException) as exc:
        run(login(body, req))
    assert exc.value.status_code == 403


def test_login_verified_account_succeeds():
    db = FakeDB()
    pw = "Str0ng!Pass"
    user_row = FakeRow(
        id="uid-1",
        email="couple@example.com",
        password_hash=_hash_password(pw),
        name="Alice & Bob",
        role="admin",
        is_active=1,
        email_verified=1,          # ← verified
        current_wedding_id="wid-1",
        created_at="2026-01-01",
        updated_at="2026-01-01",
    )
    db._add_result("SELECT * FROM USERS WHERE EMAIL", [user_row])
    req = _make_request(db)

    from routes.auth_routes import LoginBody
    body = LoginBody(email="couple@example.com", password=pw)

    result = run(login(body, req))
    assert result["user"]["email"] == "couple@example.com"
    assert "access_token" in result
