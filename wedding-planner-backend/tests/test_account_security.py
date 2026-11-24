"""Profile changes need the current password; sessions are revocable; disabled accounts can't log in."""
import sys

PW = "Str0ng!Pass1"
NEW_PW = "An0ther!Pass2"


def _register(world, email="u@example.com"):
    r = world.client.post("/api/auth/couple/register", json={
        "email": email, "password": PW, "password_confirmation": PW,
        "partner_one_first_name": "Ann", "partner_one_last_name": "Lee",
        "partner_two_first_name": "Bo", "partner_two_last_name": "Kim"})
    assert r.status_code == 201, r.text
    world.db.execute("UPDATE users SET email_verified = 1 WHERE email = ?", email)


def _login(world, email="u@example.com", pw=PW):
    return world.client.post("/api/auth/login", json={"email": email, "password": pw})


def _h(resp):
    return {"Authorization": f"Bearer {resp.json()['access_token']}"}


def _put(world, h, **body):
    return world.client.put("/api/auth/profile", json=body, headers=h)


def _sent_emails(monkeypatch):
    sent = []

    async def fake(email, name, token):
        sent.append((email, token))
        return True

    monkeypatch.setattr(sys.modules["services.email_service"], "send_verification_email", fake)
    return sent


def test_name_change_needs_no_password(world):
    _register(world)
    h = _h(_login(world))
    r = _put(world, h, name="New Name")
    assert r.status_code == 200 and r.json()["name"] == "New Name"


def test_email_or_password_change_requires_current_password(world):
    _register(world)
    h = _h(_login(world))
    for body in ({"email": "new@example.com"}, {"password": NEW_PW}):
        r = _put(world, h, **body)
        assert r.status_code == 400 and r.json()["code"] == "current_password_required"
        r = _put(world, h, current_password="wrong-password", **body)
        assert r.status_code == 403 and r.json()["code"] == "invalid_current_password"
    row = world.db.rows("SELECT email, pending_email FROM users")[0]
    assert row == {"email": "u@example.com", "pending_email": None}
    assert _login(world, pw=PW).status_code == 200      # password unchanged


def test_email_change_is_pending_until_new_address_verified(world, monkeypatch):
    sent = _sent_emails(monkeypatch)
    _register(world)
    h = _h(_login(world))
    sent.clear()  # drop the registration email
    r = _put(world, h, email="New@Example.com", current_password=PW)
    assert r.status_code == 200
    assert r.json()["email"] == "u@example.com" and r.json()["pending_email"] == "new@example.com"
    assert [e for e, _ in sent] == ["new@example.com"]

    # Old address keeps working; the new one doesn't yet.
    assert _login(world, "u@example.com").status_code == 200
    assert _login(world, "new@example.com").status_code == 401

    v = world.client.post("/api/auth/verify-email", json={"token": sent[0][1]})
    assert v.status_code == 200
    row = world.db.rows("SELECT email, pending_email, email_verified FROM users")[0]
    assert row == {"email": "new@example.com", "pending_email": None, "email_verified": 1}
    assert _login(world, "new@example.com").status_code == 200
    assert _login(world, "u@example.com").status_code == 401
    # token is single-use
    assert world.client.post("/api/auth/verify-email", json={"token": sent[0][1]}).status_code == 400


def test_email_change_rejects_addresses_in_use_or_pending(world, monkeypatch):
    _sent_emails(monkeypatch)
    _register(world, "a@example.com"); _register(world, "b@example.com")
    ha = _h(_login(world, "a@example.com")); hb = _h(_login(world, "b@example.com"))
    r = _put(world, ha, email="b@example.com", current_password=PW)
    assert r.status_code == 400 and r.json()["code"] == "email_in_use"
    assert _put(world, ha, email="c@example.com", current_password=PW).status_code == 200
    r = _put(world, hb, email="c@example.com", current_password=PW)   # pending for a@
    assert r.status_code == 400 and r.json()["code"] == "email_in_use"


def test_password_change_revokes_old_tokens_and_returns_a_fresh_one(world):
    _register(world)
    old = _login(world)
    r = _put(world, _h(old), password=NEW_PW, current_password=PW)
    assert r.status_code == 200
    assert world.client.get("/api/auth/profile", headers=_h(old)).status_code == 401
    r2 = world.client.get("/api/auth/profile", headers={"Authorization": f"Bearer {r.json()['access_token']}"})
    assert r2.status_code == 200
    assert _login(world, pw=PW).status_code == 401 and _login(world, pw=NEW_PW).status_code == 200


def test_revoked_session_envelope(world):
    _register(world)
    h = _h(_login(world))
    world.db.execute("UPDATE users SET token_version = token_version + 1")
    r = world.client.get("/api/auth/profile", headers=h)
    assert r.status_code == 401 and r.json()["code"] == "session_revoked"


def test_password_reset_revokes_sessions(world):
    _register(world)
    old = _login(world)
    world.db.execute(
        "INSERT INTO password_reset_tokens (id, user_id, token, expires_at) "
        "SELECT 't1', id, 'resettoken', datetime('now','+1 hour') FROM users")
    r = world.client.post("/api/auth/reset-password",
                          json={"token": "resettoken", "password": NEW_PW, "password_confirmation": NEW_PW})
    assert r.status_code == 200, r.text
    assert world.client.get("/api/auth/profile", headers=_h(old)).status_code == 401
    assert _login(world, pw=NEW_PW).status_code == 200


def test_login_rejects_disabled_account(world):
    _register(world)
    world.db.execute("UPDATE users SET is_active = 0")
    r = _login(world)
    assert r.status_code == 403 and r.json()["code"] == "account_disabled"
    # wrong password still looks like bad credentials (no state leak)
    assert _login(world, pw="nope-nope-1").status_code == 401


def test_deactivation_by_admin_revokes_live_session(world, monkeypatch):
    monkeypatch.setenv("ADMIN_EMAILS", "boss@example.com")
    boss = world.wedding("boss@example.com")
    _register(world)
    h = _h(_login(world))
    uid = world.db.rows("SELECT id FROM users WHERE email='u@example.com'")[0]["id"]
    r = world.client.put(f"/api/users/{uid}", json={"is_active": 0}, headers=boss.h)
    assert r.status_code == 200
    r = world.client.get("/api/auth/profile", headers=h)
    assert r.status_code == 403 and r.json()["code"] == "account_disabled"


def test_legacy_token_without_version_claim_still_works(world):
    _register(world)
    import jwt, os
    uid = world.db.rows("SELECT id FROM users")[0]["id"]
    tok = jwt.encode({"sub": uid, "role": "admin", "exp": 9999999999}, os.environ["JWT_SECRET_KEY"], algorithm="HS256")
    assert world.client.get("/api/auth/profile", headers={"Authorization": f"Bearer {tok}"}).status_code == 200
