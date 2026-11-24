"""Moodboard contract tests through the real mounted app (paths, auth, envelope)."""
import json

BASE = "/api/moodboards"


def _make(world, w, title="Main"):
    r = world.client.post(BASE, json={"title": title}, headers=w.h)
    assert r.status_code == 201, r.text
    return r.json()


def test_mounted_under_api_prefix(world):
    a = world.wedding("a@x.com", plan="premium")
    assert world.client.get(BASE, headers=a.h).status_code == 200
    # the old, unprefixed mount must be gone
    assert world.client.get("/moodboards", headers=a.h).status_code == 404


def test_requires_auth(world):
    r = world.client.get(BASE)
    assert r.status_code == 401 and set(r.json()) == {"code", "detail"}


def test_free_plan_is_403_upgrade_required(world):
    free = world.wedding("free@x.com", plan="free")
    for method, path, kw in [
        ("get", BASE, {}),
        ("post", BASE, {"json": {"title": "x"}}),
        ("post", f"{BASE}/reset", {}),
        ("get", f"{BASE}/abc", {}),
        ("patch", f"{BASE}/abc", {"json": {"title": "x"}}),
        ("put", f"{BASE}/abc/content", {"json": {"content_json": {}}}),
        ("delete", f"{BASE}/abc", {}),
    ]:
        r = getattr(world.client, method)(path, headers=free.h, **kw)
        assert r.status_code == 403, (method, path, r.text)
        assert r.json()["code"] == "upgrade_required"
        assert r.json()["feature"] == "moodboard"


def test_crud_contract_shapes(world):
    a = world.wedding("a@x.com", plan="premium")
    board = _make(world, a, "Spring")
    assert board["title"] == "Spring" and board["content_json"] == {}

    listing = world.client.get(BASE, headers=a.h).json()
    assert [set(b) for b in listing] == [{"id", "title", "updated_at"}]

    got = world.client.get(f"{BASE}/{board['id']}", headers=a.h).json()
    assert got == {"id": board["id"], "title": "Spring", "content_json": {}}

    r = world.client.delete(f"{BASE}/{board['id']}", headers=a.h)
    assert r.status_code == 200
    assert world.client.get(f"{BASE}/{board['id']}", headers=a.h).status_code == 404


def test_rename_never_touches_content(world):
    a = world.wedding("a@x.com", plan="premium")
    board = _make(world, a)
    canvas = {"version": 1, "objects": [{"id": "o1", "type": "text", "text": "hello"}]}
    r = world.client.put(f"{BASE}/{board['id']}/content", json={"content_json": canvas}, headers=a.h)
    assert r.status_code == 200

    # rename, and a PATCH that tries to smuggle content in
    r = world.client.patch(
        f"{BASE}/{board['id']}",
        json={"title": "Renamed", "content_json": {"objects": []}, "contentJson": "{}"},
        headers=a.h,
    )
    assert r.status_code == 200 and r.json()["title"] == "Renamed"
    r = world.client.patch(f"{BASE}/{board['id']}", json={}, headers=a.h)  # no-op patch
    assert r.status_code == 200

    got = world.client.get(f"{BASE}/{board['id']}", headers=a.h).json()
    assert got["title"] == "Renamed"
    assert got["content_json"] == canvas


def test_put_content_replaces_whole_document_and_accepts_string(world):
    a = world.wedding("a@x.com", plan="premium")
    board = _make(world, a)
    world.client.put(f"{BASE}/{board['id']}/content",
                     json={"content_json": {"objects": [1, 2, 3], "palette": ["#fff"]}}, headers=a.h)
    r = world.client.put(f"{BASE}/{board['id']}/content",
                         json={"content_json": json.dumps({"objects": []})}, headers=a.h)
    assert r.status_code == 200
    got = world.client.get(f"{BASE}/{board['id']}", headers=a.h).json()
    assert got["content_json"] == {"objects": []}  # replaced, not merged


def test_content_validation_and_size_cap(world):
    a = world.wedding("a@x.com", plan="premium")
    board = _make(world, a)
    url = f"{BASE}/{board['id']}/content"
    r = world.client.put(url, json={"content_json": "not json"}, headers=a.h)
    assert r.status_code == 400 and r.json()["code"] == "invalid_content"
    r = world.client.put(url, json={"content_json": "[1,2]"}, headers=a.h)
    assert r.status_code == 400
    r = world.client.put(url, json={"content_json": {"blob": "x" * 1_100_000}}, headers=a.h)
    assert r.status_code == 413
    assert r.json()["code"] == "payload_too_large"
    # a rejected save leaves existing content intact
    ok = {"objects": [{"id": "keep"}]}
    world.client.put(url, json={"content_json": ok}, headers=a.h)
    world.client.put(url, json={"content_json": {"blob": "x" * 1_100_000}}, headers=a.h)
    assert world.client.get(f"{BASE}/{board['id']}", headers=a.h).json()["content_json"] == ok


def test_cross_wedding_access_is_404(world):
    a = world.wedding("a@x.com", plan="premium")
    b = world.wedding("b@x.com", plan="premium")
    board = _make(world, a, "A's board")
    bid = board["id"]
    assert world.client.get(f"{BASE}/{bid}", headers=b.h).status_code == 404
    assert world.client.patch(f"{BASE}/{bid}", json={"title": "pwn"}, headers=b.h).status_code == 404
    assert world.client.put(f"{BASE}/{bid}/content", json={"content_json": {"x": 1}}, headers=b.h).status_code == 404
    assert world.client.delete(f"{BASE}/{bid}", headers=b.h).status_code == 404
    assert world.client.get(BASE, headers=b.h).json() == []
    # untouched
    got = world.client.get(f"{BASE}/{bid}", headers=a.h).json()
    assert got["title"] == "A's board" and got["content_json"] == {}


def test_boards_are_shared_across_the_wedding(world):
    """Both partners resolve to the same wedding, so they see the same boards."""
    a = world.wedding("a@x.com", plan="premium")
    board = _make(world, a)
    partner_id = "partner-user"
    world.db.execute(
        "INSERT INTO users (id, email, password_hash, name, role, is_active, email_verified, "
        "current_wedding_id) VALUES (?, 'p@x.com', 'x', 'P', 'admin', 1, 1, ?)", partner_id, a.id)
    import sys
    token = sys.modules["auth"].create_token(partner_id, a.id, "admin")
    h = {"Authorization": f"Bearer {token}"}
    assert [b["id"] for b in world.client.get(BASE, headers=h).json()] == [board["id"]]


def test_reset_replaces_only_this_weddings_boards(world):
    a = world.wedding("a@x.com", plan="premium")
    b = world.wedding("b@x.com", plan="premium")
    _make(world, a, "one"); _make(world, a, "two"); keep = _make(world, b, "B's")
    r = world.client.post(f"{BASE}/reset", headers=a.h)
    assert r.status_code == 201 and r.json()["title"] == "Main Moodboard"
    assert [x["title"] for x in world.client.get(BASE, headers=a.h).json()] == ["Main Moodboard"]
    assert [x["id"] for x in world.client.get(BASE, headers=b.h).json()] == [keep["id"]]


def test_blank_title_rejected(world):
    a = world.wedding("a@x.com", plan="premium")
    r = world.client.post(BASE, json={"title": "   "}, headers=a.h)
    assert r.status_code == 400 and r.json()["code"] == "invalid_title"
