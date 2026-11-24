"""The {code, detail} envelope keeps extra keys and maps legacy error_code."""
from tests.conftest import World  # noqa: F401  (fixtures come from conftest)

REG = {
    "email": "new@example.com",
    "password": "Str0ng!Pass1",
    "password_confirmation": "Str0ng!Pass1",
    "partner_one_first_name": "Ann",
    "partner_one_last_name": "Lee",
    "partner_two_first_name": "Bo",
    "partner_two_last_name": "Kim",
}


def test_normalize_passes_extra_keys_and_maps_error_code(real_app):
    from errors import _normalize
    assert _normalize(400, {"code": "x", "detail": "d", "missing_fields": ["a"], "errors": ["e"]}) == {
        "code": "x", "detail": "d", "missing_fields": ["a"], "errors": ["e"],
    }
    legacy = _normalize(403, {"error_code": "email_not_verified", "message": "verify"})
    assert legacy == {"code": "email_not_verified", "detail": "verify"}
    # legacy `error` text key folds into detail and is not echoed
    assert _normalize(400, {"code": "invalid", "error": "bad"}) == {"code": "invalid", "detail": "bad"}
    assert _normalize(404, "nope") == {"code": "not_found", "detail": "nope"}
    assert _normalize(500, None) == {"code": "internal_error", "detail": "internal error"}


def test_register_missing_fields(world):
    body = {**REG, "partner_two_first_name": ""}
    r = world.client.post("/api/auth/couple/register", json=body)
    assert r.status_code == 400
    assert r.json() == {
        "code": "missing_fields",
        "detail": "Missing required fields",
        "missing_fields": ["partner_two_first_name"],
    }


def test_register_weak_password_lists_errors(world):
    body = {**REG, "password": "password", "password_confirmation": "password"}
    r = world.client.post("/api/auth/couple/register", json=body)
    assert r.status_code == 400
    j = r.json()
    assert j["code"] == "weak_password" and j["detail"] == "Password too weak"
    assert isinstance(j["errors"], list) and j["errors"]


def test_login_unverified_email_code(world):
    reg = world.client.post("/api/auth/couple/register", json=REG)
    assert reg.status_code == 201, reg.text
    r = world.client.post("/api/auth/login", json={"email": REG["email"], "password": REG["password"]})
    assert r.status_code == 403
    assert r.json()["code"] == "email_not_verified"
    assert "verify" in r.json()["detail"].lower()
    assert "error_code" not in r.json()


def test_login_bad_credentials_plain_envelope(world):
    r = world.client.post("/api/auth/login", json={"email": "no@x.com", "password": "whatever1"})
    assert r.status_code == 401
    assert r.json() == {"code": "unauthorized", "detail": "Invalid credentials"}
