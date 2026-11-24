"""Settings changes on a published site purge its edge cache."""
import sys

import pytest

SETTINGS = "/api/website/settings"


@pytest.fixture()
def purged(monkeypatch, real_app):
    calls = []

    async def rec(slug):
        calls.append(slug)

    monkeypatch.setattr(sys.modules["routes.website_routes"], "purge_site_cache", rec)
    return calls


def _site(world, w, status="published", **cols):
    world.db.execute("INSERT INTO wedding_sites (wedding_id, slug, status, theme, rsvp_enabled) VALUES (?, 'ann-bo', ?, 'classic', 1)",
                     w.id, status)
    for k, v in cols.items():
        world.db.execute(f"UPDATE wedding_sites SET {k} = ?", v)


def _put(world, w, **body):
    r = world.client.put(SETTINGS, json=body, headers=w.h)
    assert r.status_code == 200, r.text
    return r


def test_password_set_and_clear_purge(world, purged):
    w = world.wedding("a@x.com", plan="premium"); _site(world, w)
    _put(world, w, password="hunter2hunter2")
    assert purged == ["ann-bo"]
    _put(world, w, password="")
    assert purged == ["ann-bo", "ann-bo"]


def test_rsvp_enabled_change_purges_but_same_value_does_not(world, purged):
    w = world.wedding("a@x.com", plan="premium"); _site(world, w)
    _put(world, w, rsvp_enabled=True)       # unchanged
    assert purged == []
    _put(world, w, rsvp_enabled=False)
    assert purged == ["ann-bo"]


def test_theme_change_purges_same_theme_does_not(world, purged):
    w = world.wedding("a@x.com", plan="premium"); _site(world, w)
    _put(world, w, theme="classic")
    assert purged == []
    other = [t for t in sys.modules["services.site_schema"].VALID_THEMES if t != "classic"][0]
    _put(world, w, theme=other)
    assert purged == ["ann-bo"]


def test_unpublished_site_is_not_purged(world, purged):
    w = world.wedding("a@x.com", plan="premium"); _site(world, w, status="draft")
    _put(world, w, password="hunter2hunter2", rsvp_enabled=False)
    assert purged == []


def test_slug_change_still_purges_both(world, purged):
    w = world.wedding("a@x.com", plan="premium"); _site(world, w)
    _put(world, w, slug="new-address")
    assert purged == ["ann-bo", "new-address"]
