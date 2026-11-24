"""Stripe webhook idempotency: an event is marked seen only after its handler succeeds."""
import hashlib
import hmac
import json
import sys
import time

import pytest

SECRET = "whsec_test"
URL = "/api/billing/webhook"


def _post(world, event):
    raw = json.dumps(event).encode()
    t = str(int(time.time()))
    sig = hmac.new(SECRET.encode(), f"{t}.".encode() + raw, hashlib.sha256).hexdigest()
    return world.client.post(URL, content=raw, headers={"Stripe-Signature": f"t={t},v1={sig}",
                                                         "Content-Type": "application/json"})


def _event(wid, eid="evt_1"):
    return {"id": eid, "type": "checkout.session.completed",
            "data": {"object": {"client_reference_id": wid, "mode": "payment", "customer": "cus_1"}}}


def _plan(world, wid):
    return world.db.rows("SELECT plan FROM weddings WHERE id = ?", wid)[0]["plan"]


@pytest.fixture(autouse=True)
def _secret(monkeypatch):
    monkeypatch.setenv("STRIPE_WEBHOOK_SECRET", SECRET)


def test_handler_failure_is_not_marked_seen_and_retry_processes_once(world, monkeypatch):
    w = world.wedding("a@x.com")
    billing = sys.modules["routes.billing_routes"]
    real = billing._handle_checkout_completed
    calls = {"n": 0}

    async def flaky(db, obj):
        calls["n"] += 1
        if calls["n"] == 1:
            raise RuntimeError("db hiccup")
        return await real(db, obj)

    monkeypatch.setattr(billing, "_handle_checkout_completed", flaky)

    r = _post(world, _event(w.id))
    assert r.status_code == 500 and r.json()["code"] == "webhook_handler_failed"
    assert world.db.rows("SELECT id FROM stripe_events") == []   # not marked seen
    assert _plan(world, w.id) == "free"

    r = _post(world, _event(w.id))                                # Stripe retries
    assert r.status_code == 200 and r.json() == {"received": True}
    assert _plan(world, w.id) == "lifetime"
    assert calls["n"] == 2
    assert [e["id"] for e in world.db.rows("SELECT id FROM stripe_events")] == ["evt_1"]

    r = _post(world, _event(w.id))                                # late duplicate
    assert r.status_code == 200 and r.json()["duplicate"] is True
    assert calls["n"] == 2                                        # handler not run again


def test_success_then_duplicate_is_noop(world, monkeypatch):
    w = world.wedding("a@x.com")
    billing = sys.modules["routes.billing_routes"]
    real = billing._handle_checkout_completed
    calls = {"n": 0}

    async def counting(db, obj):
        calls["n"] += 1
        return await real(db, obj)

    monkeypatch.setattr(billing, "_handle_checkout_completed", counting)
    assert _post(world, _event(w.id)).json() == {"received": True}
    assert _post(world, _event(w.id)).json() == {"received": True, "duplicate": True}
    assert calls["n"] == 1 and _plan(world, w.id) == "lifetime"


def test_bad_signature_rejected(world):
    r = world.client.post(URL, content=b"{}", headers={"Stripe-Signature": "t=1,v1=bad"})
    assert r.status_code == 400
