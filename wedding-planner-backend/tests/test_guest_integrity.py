"""Plan limits, RSVP validation, CSV import and cascading deletes (real app)."""
import json
import uuid

import pytest

G = "/api/guests"


def _guest_body(i=0, **kw):
    return {"first_name": f"G{i}", "last_name": "Test", "email": f"g{i}@x.com", **kw}


def _mk(world, w, i=0, **kw):
    r = world.client.post(G, json=_guest_body(i, **kw), headers=w.h)
    assert r.status_code == 201, r.text
    return r.json()["guest"]


def _token_headers(world, guest):
    r = world.client.post(f"{G}/token/{guest['unique_token']}/auth")
    return {"Authorization": f"Bearer {r.json()['access_token']}"}


# ------------------------------------------------------------------ limits
def test_free_plan_guest_limit_is_403_limit_reached(world):
    w = world.wedding("a@x.com", plan="free")
    for i in range(30):
        world.db.execute(
            "INSERT INTO guests (id, wedding_id, first_name, last_name, email, unique_token) "
            "VALUES (?,?,?,?,?,?)", str(uuid.uuid4()), w.id, "g", "x", f"e{i}@x.com", str(uuid.uuid4()))
    r = world.client.post(G, json=_guest_body(99), headers=w.h)
    assert r.status_code == 403
    assert r.json() == {"code": "limit_reached", "detail": r.json()["detail"], "limit": 30, "feature": "guests"}


def test_premium_has_no_guest_limit_and_other_weddings_dont_count(world):
    free = world.wedding("f@x.com", plan="free")
    other = world.wedding("o@x.com", plan="free")
    for i in range(29):
        world.db.execute(
            "INSERT INTO guests (id, wedding_id, first_name, last_name, email, unique_token) "
            "VALUES (?,?,?,?,?,?)", str(uuid.uuid4()), other.id, "g", "x", f"e{i}@x.com", str(uuid.uuid4()))
    assert world.client.post(G, json=_guest_body(1), headers=free.h).status_code == 201


def test_task_limit(world):
    w = world.wedding("a@x.com", plan="free")
    for i in range(10):
        assert world.client.post("/api/tasks", json={"title": f"t{i}"}, headers=w.h).status_code == 201
    r = world.client.post("/api/tasks", json={"title": "one too many"}, headers=w.h)
    assert r.status_code == 403
    assert (r.json()["code"], r.json()["limit"], r.json()["feature"]) == ("limit_reached", 10, "tasks")
    prem = world.wedding("p@x.com", plan="premium")
    for i in range(12):
        assert world.client.post("/api/tasks", json={"title": f"t{i}"}, headers=prem.h).status_code == 201


def test_csv_import_stops_at_limit_and_reports_leftovers(world):
    w = world.wedding("a@x.com", plan="free")
    for i in range(28):
        world.db.execute(
            "INSERT INTO guests (id, wedding_id, first_name, last_name, email, unique_token) "
            "VALUES (?,?,?,?,?,?)", str(uuid.uuid4()), w.id, "g", "x", f"old{i}@x.com", str(uuid.uuid4()))
    csv_text = "first_name,last_name,email\n" + "".join(f"A{i},B,new{i}@x.com\n" for i in range(5))
    r = world.client.post(f"{G}/import", content=csv_text.encode(), headers=w.h)
    assert r.status_code == 200
    j = r.json()
    assert j["created"] == 2 and j["limit"] == 30 and j["limit_reached"] is True
    assert [x["row"] for x in j["not_imported"]] == [4, 5, 6]
    assert all(x["reason"] == "limit_reached" for x in j["not_imported"])
    assert world.db.rows("SELECT COUNT(*) n FROM guests WHERE wedding_id=?", w.id)[0]["n"] == 30
    # now at the limit: the whole import is refused
    r = world.client.post(f"{G}/import", content=csv_text.encode(), headers=w.h)
    assert r.status_code == 403 and r.json()["code"] == "limit_reached"


def test_csv_import_skips_existing_and_in_file_duplicate_emails(world):
    w = world.wedding("a@x.com", plan="premium")
    _mk(world, w, 1)  # g1@x.com
    csv_text = ("first_name,last_name,email\nA,B,G1@X.com\nC,D,new@x.com\nE,F,NEW@x.com\n")
    j = world.client.post(f"{G}/import", content=csv_text.encode(), headers=w.h).json()
    assert j["created"] == 1
    assert j["skipped_duplicates"] == [{"row": 2, "email": "G1@X.com"}, {"row": 4, "email": "NEW@x.com"}]
    # same email in ANOTHER wedding is fine
    w2 = world.wedding("b@x.com", plan="premium")
    j = world.client.post(f"{G}/import", content=b"first_name,last_name,email\nA,B,g1@x.com\n", headers=w2.h).json()
    assert j["created"] == 1 and j["skipped_duplicates"] == []


def test_csv_import_rejects_bad_rsvp_status_row(world):
    w = world.wedding("a@x.com", plan="premium")
    j = world.client.post(f"{G}/import", content=b"first_name,last_name,email,rsvp_status\nA,B,a@x.com,maybe\n", headers=w.h).json()
    assert j["created"] == 0 and "rsvp_status" in j["errors"][0]["error"]


# ------------------------------------------------------------- RSVP validation
def _rsvp(world, h, **body):
    return world.client.put(f"{G}/update-rsvp", json=body, headers=h)


def test_rsvp_status_must_be_known(world):
    w = world.wedding("a@x.com", plan="premium")
    h = _token_headers(world, _mk(world, w))
    r = _rsvp(world, h, rsvp_status="yes please")
    assert r.status_code == 422 and r.json()["code"] == "invalid_rsvp_status"
    for ok in ("confirmed", "declined", "pending"):
        assert _rsvp(world, h, rsvp_status=ok).status_code == 200


def test_attending_names_must_be_household_subset_case_insensitive(world):
    w = world.wedding("a@x.com", plan="premium")
    g = _mk(world, w, first_name="Ann", last_name="Lee", invitee_names=["Bo Kim", "Cy Lee"])
    h = _token_headers(world, g)
    r = _rsvp(world, h, rsvp_status="confirmed", attending_names=["ann lee", "BO  kim"])
    assert r.status_code == 200
    out = r.json()["guest"]
    assert out["attending_names"] == ["Ann Lee", "Bo Kim"]   # canonical spelling
    assert out["number_of_guests"] == 2                       # derived, not trusted
    r = _rsvp(world, h, rsvp_status="confirmed", attending_names=["Ann Lee", "Mallory"])
    assert r.status_code == 422
    assert r.json()["code"] == "invalid_attending_names" and r.json()["invalid_names"] == ["Mallory"]


def test_number_of_guests_ignored_when_attending_given_and_capped_otherwise(world):
    w = world.wedding("a@x.com", plan="premium")
    g = _mk(world, w, first_name="Ann", last_name="Lee", invitee_names=["Bo Kim"])
    h = _token_headers(world, g)
    out = _rsvp(world, h, rsvp_status="confirmed", attending_names=["Ann Lee"], number_of_guests=50).json()["guest"]
    assert out["number_of_guests"] == 1
    out = _rsvp(world, h, number_of_guests=50).json()["guest"]
    assert out["number_of_guests"] == 2          # 1 + len(invitee_names)


def test_declined_household_has_nobody_attending(world):
    w = world.wedding("a@x.com", plan="premium")
    g = _mk(world, w, first_name="Ann", last_name="Lee")
    out = _rsvp(world, _token_headers(world, g), rsvp_status="declined",
                attending_names=["Ann Lee"]).json()["guest"]
    assert out["attending_names"] == [] and out["number_of_guests"] == 0


def test_free_text_max_length_500(world):
    w = world.wedding("a@x.com", plan="premium")
    h = _token_headers(world, _mk(world, w))
    assert _rsvp(world, h, allergies="x" * 500).status_code == 200
    r = _rsvp(world, h, allergies="x" * 501)
    assert r.status_code == 422
    assert r.json()["code"] == "field_too_long" and r.json()["field"] == "allergies"


def test_admin_update_guest_mirrors_validation(world):
    w = world.wedding("a@x.com", plan="premium")
    g = _mk(world, w, first_name="Ann", last_name="Lee", invitee_names=["Bo Kim"])
    url = f"{G}/{g['id']}"
    assert world.client.put(url, json={"rsvp_status": "bogus"}, headers=w.h).status_code == 422
    assert world.client.put(url, json={"notes": "n" * 501}, headers=w.h).json()["code"] == "field_too_long"
    assert world.client.put(url, json={"attending_names": ["Eve"]}, headers=w.h).status_code == 422
    r = world.client.put(url, json={"rsvp_status": "confirmed", "attending_names": ["bo kim"], "number_of_guests": 9}, headers=w.h)
    assert r.status_code == 200
    assert r.json()["attending_names"] == ["Bo Kim"] and r.json()["number_of_guests"] == 1
    # household follows a rename sent in the same request
    r = world.client.put(url, json={"first_name": "Zed", "attending_names": ["Zed Lee"]}, headers=w.h)
    assert r.status_code == 200 and r.json()["attending_names"] == ["Zed Lee"]


# ------------------------------------------------------------- deletes / batching
def _table_with_seat(world, w, guest_id):
    tid, sid = str(uuid.uuid4()), str(uuid.uuid4())
    world.db.execute("INSERT INTO seating_tables (id, wedding_id, name, capacity) VALUES (?,?,?,?)", tid, w.id, "T1", 8)
    world.db.execute("INSERT INTO seat_assignments (id, table_id, wedding_id, guest_id, seat_number) VALUES (?,?,?,?,1)",
                     sid, tid, w.id, guest_id)
    return tid


def test_delete_guest_deletes_seats_and_cleans_up_in_one_batch(world):
    w = world.wedding("a@x.com", plan="premium")
    g = _mk(world, w)
    _table_with_seat(world, w, g["id"])
    world.db.execute("INSERT INTO reminder_sent (id, reminder_id, guest_id) VALUES ('rs','r',?)", g["id"])
    r = world.client.delete(f"{G}/{g['id']}", headers=w.h)
    assert r.status_code == 200
    assert world.db.rows("SELECT * FROM seat_assignments") == []      # deleted, not NULLed
    assert world.db.rows("SELECT * FROM reminder_sent") == []
    assert world.db.rows("SELECT * FROM guests") == []


def test_delete_guest_is_all_or_nothing(world, monkeypatch):
    w = world.wedding("a@x.com", plan="premium")
    g = _mk(world, w)
    _table_with_seat(world, w, g["id"])
    world.db.execute("CREATE TRIGGER boom BEFORE DELETE ON guests BEGIN SELECT RAISE(ABORT, 'boom'); END")
    from fastapi.testclient import TestClient
    c = TestClient(world.client.app, raise_server_exceptions=False)
    assert c.delete(f"{G}/{g['id']}", headers=w.h).status_code == 500
    assert len(world.db.rows("SELECT * FROM seat_assignments")) == 1   # rolled back
    assert len(world.db.rows("SELECT * FROM guests")) == 1


def test_delete_table_removes_its_seats(world):
    w = world.wedding("a@x.com", plan="premium")
    g = _mk(world, w)
    tid = _table_with_seat(world, w, g["id"])
    assert world.client.delete(f"/api/seating/tables/{tid}", headers=w.h).status_code == 200
    assert world.db.rows("SELECT * FROM seat_assignments") == []
    assert world.db.rows("SELECT * FROM seating_tables") == []


def test_orphan_seat_migration_removes_only_null_guest_rows(world):
    w = world.wedding("a@x.com", plan="premium")
    g = _mk(world, w)
    _table_with_seat(world, w, g["id"])
    world.db.execute("INSERT INTO seat_assignments (id, table_id, wedding_id, guest_id) VALUES ('orph','t',?,NULL)", w.id)
    import pathlib
    sql = (pathlib.Path(__file__).parent.parent / "migrations" / "008_cleanup_orphan_seat_assignments.sql").read_text()
    world.db.conn.executescript(sql)
    assert [r["id"] for r in world.db.rows("SELECT id FROM seat_assignments")] != ["orph"]
    assert len(world.db.rows("SELECT * FROM seat_assignments")) == 1


def test_tasks_without_due_date_sort_last(world):
    w = world.wedding("a@x.com", plan="premium")
    for title, due in [("none", None), ("late", "2026-09-01"), ("early", "2026-01-01")]:
        world.client.post("/api/tasks", json={"title": title, "due_date": due}, headers=w.h)
    assert [t["title"] for t in world.client.get("/api/tasks", headers=w.h).json()] == ["early", "late", "none"]


def test_onboarding_default_date_is_naive_utc_180_days_out(real_app):
    import warnings
    from datetime import datetime, timedelta, timezone
    import sys
    onb = sys.modules["routes.onboarding_routes"]
    with warnings.catch_warnings():
        warnings.simplefilter("error", DeprecationWarning)
        d = onb._parse_wedding_date("")
    assert d.tzinfo is None
    expected = datetime.now(timezone.utc).replace(tzinfo=None) + timedelta(days=180)
    assert abs((d - expected).total_seconds()) < 5
