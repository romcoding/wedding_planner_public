"""Couple-facing analytics through the real mounted app."""
import json
import sys
import uuid
from datetime import date, timedelta

import pytest


def _guest(world, wid, *, status="pending", n=1, invitees=None, attending=None, overnight=0,
           diet=None, allergies=None, special=None, updated="2026-01-10 10:00:00"):
    world.db.execute(
        "INSERT INTO guests (id, wedding_id, first_name, last_name, email, unique_token, rsvp_status, "
        "overnight_stay, number_of_guests, invitee_names, attending_names, dietary_restrictions, "
        "allergies, special_requests, updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)",
        str(uuid.uuid4()), wid, "G", "X", "g@x.com", str(uuid.uuid4()), status, overnight, n,
        json.dumps(invitees) if invitees else None, json.dumps(attending) if attending else None,
        diet, allergies, special, updated,
    )


def _cost(world, wid, amount, status):
    world.db.execute(
        "INSERT INTO costs (id, wedding_id, name, category, amount, status) VALUES (?,?,?,?,?,?)",
        str(uuid.uuid4()), wid, "c", "venue", amount, status,
    )


def test_overview_requires_auth_and_has_envelope(world):
    r = world.client.get("/api/analytics/overview")
    assert r.status_code == 401 and set(r.json()) == {"code", "detail"}


def test_overview_counts_people_not_rows(world):
    soon = (date.today() + timedelta(days=40)).isoformat()
    w = world.wedding("a@x.com", wedding_date=soon)
    # household of 3 -> 2 attending, 1 not
    _guest(world, w.id, status="confirmed", n=2, invitees=["A", "B", "C"], attending=["A", "B"],
           overnight=1, diet="vegan", allergies="nuts")
    # household of 2 confirmed, no overnight
    _guest(world, w.id, status="confirmed", n=2, invitees=["D", "E"], attending=["D", "E"], special="high chair")
    # household of 4 pending; solo declined (declined guests' diet ignored)
    _guest(world, w.id, status="pending", n=4, invitees=["F", "G", "H", "I"], diet="gluten-free")
    _guest(world, w.id, status="declined", n=1, diet="ignored")
    # solo pending with no names: falls back to number_of_guests
    _guest(world, w.id, status="pending", n=1)

    j = world.client.get("/api/analytics/overview", headers=w.h).json()
    assert j["guests"] == {"total": 5, "by_status": {"pending": 2, "confirmed": 2, "declined": 1}}
    assert j["headcount"] == {"invited": 11, "confirmed": 4, "pending": 5, "declined": 2}
    assert j["headcount"]["invited"] == sum(j["headcount"][k] for k in ("confirmed", "pending", "declined"))
    assert j["overnight"] == {"yes": 2, "no": 2}
    assert j["dietary"] == {"with_restrictions": 2, "with_allergies": 1, "with_special_requests": 1}
    assert j["wedding_date"] == soon and j["days_until"] == 40
    assert j["currency"] == "CHF"


def test_overview_budget_and_empty_wedding(world):
    w = world.wedding("a@x.com")
    j = world.client.get("/api/analytics/overview", headers=w.h).json()
    assert j["budget"] == {"planned": 0, "paid": 0, "remaining": 0}
    assert j["wedding_date"] is None and j["days_until"] is None
    assert j["headcount"] == {"invited": 0, "confirmed": 0, "pending": 0, "declined": 0}
    _cost(world, w.id, 1000, "planned"); _cost(world, w.id, 500, "paid"); _cost(world, w.id, 200, "pending")
    j = world.client.get("/api/analytics/overview", headers=w.h).json()
    assert j["budget"] == {"planned": 1700, "paid": 500, "remaining": 1200}


def test_overview_is_tenant_scoped(world):
    a = world.wedding("a@x.com"); b = world.wedding("b@x.com")
    _guest(world, a.id, status="confirmed", n=3, attending=["x", "y", "z"]); _cost(world, a.id, 99, "paid")
    j = world.client.get("/api/analytics/overview", headers=b.h).json()
    assert j["guests"]["total"] == 0 and j["budget"]["paid"] == 0


def test_removed_dead_routes_stay_removed(world):
    w = world.wedding("a@x.com")
    for p in ("/api/analytics/budget", "/api/analytics/dietary"):
        assert world.client.get(p, headers=w.h).status_code == 404


def test_rsvp_progress_buckets_by_updated_at(world):
    w = world.wedding("a@x.com"); other = world.wedding("b@x.com")
    _guest(world, w.id, status="confirmed", updated="2026-02-01 08:00:00")
    _guest(world, w.id, status="confirmed", updated="2026-02-01 18:00:00")
    _guest(world, w.id, status="declined", updated="2026-02-03 09:00:00")
    _guest(world, w.id, status="pending", updated="2026-02-03 09:00:00")  # not an answer
    _guest(world, other.id, status="confirmed", updated="2026-02-01 08:00:00")
    j = world.client.get("/api/analytics/rsvp-progress", headers=w.h).json()
    assert j == {"total_guests": 4, "daily": [
        {"date": "2026-02-01", "confirmed": 2, "declined": 0},
        {"date": "2026-02-03", "confirmed": 0, "declined": 1},
    ]}


def _publish_site(world, w, slug):
    world.db.execute(
        "INSERT INTO wedding_sites (wedding_id, slug, status) VALUES (?, ?, 'published')", w.id, slug)


def test_track_stores_wedding_from_slug_and_site_stats_filters_by_wedding(world):
    a = world.wedding("a@x.com"); b = world.wedding("b@x.com")
    _publish_site(world, a, "ann-and-bo"); _publish_site(world, b, "cy-and-di")
    for slug, path in [("ann-and-bo", "/s/ann-and-bo"), ("ann-and-bo", "/s/ann-and-bo"),
                       ("ann-and-bo", "/s/ann-and-bo#rsvp"), ("cy-and-di", "/s/cy-and-di")]:
        r = world.client.post("/api/analytics/track", json={"path": path, "slug": slug})
        assert r.status_code == 200 and r.json() == {"tracked": True}

    j = world.client.get("/api/analytics/site-stats?days=7", headers=a.h).json()
    assert j["total_views"] == 3 and j["days"] == 7
    assert j["top_pages"][0] == {"path": "/s/ann-and-bo", "views": 2}
    assert sum(d["count"] for d in j["daily_views"]) == 3
    assert world.client.get("/api/analytics/site-stats", headers=b.h).json()["total_views"] == 1


def test_track_ignores_client_supplied_wedding_id_and_unknown_slugs(world):
    a = world.wedding("a@x.com")
    r = world.client.post("/api/analytics/track", json={"path": "/x", "slug": "nope", "wedding_id": a.id})
    assert r.json() == {"tracked": False}
    # unpublished sites are not trackable either
    world.db.execute("INSERT INTO wedding_sites (wedding_id, slug, status) VALUES (?, 'draft-one', 'draft')", a.id)
    assert world.client.post("/api/analytics/track", json={"path": "/x", "slug": "draft-one"}).json() == {"tracked": False}
    # no slug: stored without a wedding, so it never shows up for any couple
    assert world.client.post("/api/analytics/track", json={"path": "/x"}).json() == {"tracked": True}
    assert world.client.get("/api/analytics/site-stats", headers=a.h).json()["total_views"] == 0


def test_security_events_are_platform_admin_only(world, monkeypatch):
    monkeypatch.setenv("ADMIN_EMAILS", "boss@x.com")
    couple = world.wedding("couple@x.com"); boss = world.wedding("boss@x.com")
    r = world.client.get("/api/analytics/security", headers=couple.h)
    assert r.status_code == 403 and set(r.json()) == {"code", "detail"}
    world.db.execute("INSERT INTO security_events (id, event_type, severity) VALUES ('e1', 'failed_login', 'low')")
    r = world.client.get("/api/analytics/security", headers=boss.h)
    assert r.status_code == 200 and r.json()[0]["event_type"] == "failed_login"
