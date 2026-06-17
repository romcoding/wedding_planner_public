"""Entitlements + Stripe-webhook unit tests.

Exercises the entitlements gate (require_feature/get_plan) and the consolidated
billing webhook handlers directly, mocking the D1 interface so no Workers
runtime is needed.
"""
import os
import sys
import json
import time
import hmac
import types
import hashlib
import asyncio
import importlib

import pytest

# ---------------------------------------------------------------------------
# Environment + Pyodide/runtime stubs (must precede the imports under test)
# ---------------------------------------------------------------------------
os.environ.setdefault("JWT_SECRET_KEY", "test-secret")
os.environ["ADMIN_EMAILS"] = "boss@example.com"
os.environ["STRIPE_WEBHOOK_SECRET"] = "whsec_test"
os.environ["STRIPE_STARTER_PRICE_ID"] = "price_starter_test"   # retired -> premium
os.environ["STRIPE_PREMIUM_PRICE_ID"] = "price_premium_test"
os.environ["STRIPE_LIFETIME_PRICE_ID"] = "price_lifetime_test"

for _n in ("workers", "asgi", "js"):
    sys.modules.setdefault(_n, types.ModuleType(_n))

# Stub `auth` so the env's native jwt/cryptography is never imported.
_auth = types.ModuleType("auth")
async def _require_couple_auth(request=None):
    return {"sub": "user"}
_auth.require_couple_auth = _require_couple_auth
_auth.decode_token = lambda t: {}
_auth.create_token = lambda *a, **k: "t"
_auth.create_guest_token = lambda *a, **k: "g"
sys.modules["auth"] = _auth

# Make src/ importable and force the *real* middleware (a prior test may have
# stubbed it).
_SRC = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "src"))
if _SRC not in sys.path:
    sys.path.insert(0, _SRC)
for _m in ("middleware", "entitlements", "db"):
    _mod = sys.modules.get(_m)
    if _mod is not None and getattr(_mod, "__file__", None) is None:
        del sys.modules[_m]

import entitlements  # noqa: E402
from fastapi import HTTPException  # noqa: E402
from routes import billing_routes  # noqa: E402


def run(coro):
    return asyncio.get_event_loop().run_until_complete(coro)


# ---------------------------------------------------------------------------
# require_feature / get_plan
# ---------------------------------------------------------------------------

def test_free_plan_gets_403_upgrade_required():
    gate = entitlements.require_feature("seating")
    with pytest.raises(HTTPException) as exc:
        run(gate(wedding={"id": "w", "plan": "free"}))
    assert exc.value.status_code == 403
    assert exc.value.detail == {"code": "upgrade_required", "feature": "seating"}


def test_premium_plan_passes():
    gate = entitlements.require_feature("seating")
    out = run(gate(wedding={"id": "w", "plan": "premium"}))
    assert out["plan"] == "premium"


def test_lifetime_plan_passes():
    gate = entitlements.require_feature("messages")
    out = run(gate(wedding={"id": "w", "plan": "lifetime"}))
    assert out["plan"] == "lifetime"


def test_admin_email_override_resolves_lifetime_and_passes():
    # get_plan resolves an ADMIN_EMAILS user to full entitlements.
    assert entitlements.get_plan({"plan": "free"}, "boss@example.com") == "lifetime"
    # A wedding resolved via that override (plan already lifetime) passes any gate.
    gate = entitlements.require_feature("venue")
    assert run(gate(wedding={"id": "w", "plan": "lifetime"}))["plan"] == "lifetime"


def test_free_plan_keeps_free_features():
    assert entitlements.plan_has_feature("free", "guests") is True
    assert entitlements.plan_has_feature("free", "seating") is False


def test_starter_normalizes_to_premium():
    assert entitlements.get_plan({"plan": "starter"}) == "premium"


# ---------------------------------------------------------------------------
# Stripe webhook — fake D1
# ---------------------------------------------------------------------------

class _Stmt:
    def __init__(self, sql, db):
        self.sql = sql
        self.db = db
        self.binds = []

    def bind(self, *args):
        self.binds = list(args)
        return self

    async def first(self):
        sql, b = self.sql, self.binds
        if "FROM stripe_events WHERE id" in sql:
            return {"id": b[0]} if b[0] in self.db.events else None
        if "SELECT id, owner_id, plan FROM weddings WHERE stripe_subscription_id" in sql:
            w = self.db.by_sub(b[0])
            return {"id": w["id"], "owner_id": w.get("owner_id"), "plan": w["plan"]} if w else None
        if "SELECT id FROM weddings WHERE stripe_subscription_id" in sql:
            w = self.db.by_sub(b[0])
            return {"id": w["id"]} if w else None
        if "SELECT plan FROM weddings WHERE id" in sql:
            w = self.db.weddings.get(b[0])
            return {"plan": w["plan"]} if w else None
        if "FROM weddings w JOIN users u" in sql:
            w = self.db.weddings.get(b[0]) or {}
            return {"partner_one_name": "A", "partner_two_name": "B", "email": "c@x.com"}
        if "SELECT email, name FROM users WHERE id" in sql:
            return {"email": "c@x.com", "name": "Couple"}
        return None

    async def run(self):
        sql, b = self.sql, self.binds
        if "INSERT OR IGNORE INTO stripe_events" in sql:
            self.db.events.add(b[0])
            return
        if "UPDATE wedding_sites" in sql:
            raise Exception("no such table: wedding_sites")  # inert until P4
        if sql.startswith("UPDATE weddings SET") or "UPDATE weddings SET" in sql:
            wid = b[-1]
            w = self.db.weddings.get(wid)
            if not w:
                return
            if "plan = 'lifetime'" in sql:
                w["plan"] = "lifetime"
            elif "plan = 'premium'" in sql:
                w["plan"] = "premium"
                w["stripe_subscription_id"] = b[1]
            elif "plan = 'free'" in sql:
                w["plan"] = "free"
                w["stripe_subscription_id"] = None
            elif "SET plan = ?" in sql:
                w["plan"] = b[0]  # subscription.updated
            # else: plan_updated_at-only (payment_failed) — no plan change
            return


class BillingFakeDB:
    def __init__(self, weddings):
        self.weddings = {w["id"]: w for w in weddings}
        self.events = set()

    def by_sub(self, sub_id):
        for w in self.weddings.values():
            if w.get("stripe_subscription_id") == sub_id:
                return w
        return None

    def prepare(self, sql):
        return _Stmt(sql, self)


def _make_webhook_request(event, db, secret="whsec_test"):
    raw = json.dumps(event).encode()
    ts = int(time.time())
    sig = hmac.new(secret.encode(), f"{ts}.".encode() + raw, hashlib.sha256).hexdigest()
    req = types.SimpleNamespace()
    async def body():
        return raw
    req.body = body
    req.headers = types.SimpleNamespace(get=lambda k, d=None: f"t={ts},v1={sig}" if k == "Stripe-Signature" else d)
    req.scope = {"env": types.SimpleNamespace(DB=db)}
    return req


def _checkout_event(eid, wedding_id, mode, price_id, sub=None):
    return {
        "id": eid, "type": "checkout.session.completed",
        "data": {"object": {
            "client_reference_id": wedding_id, "mode": mode,
            "customer": "cus_1", "subscription": sub,
            "metadata": {"wedding_id": wedding_id, "price_id": price_id},
        }},
    }


def test_webhook_starter_price_id_upgrades_to_premium():
    db = BillingFakeDB([{"id": "wA", "plan": "free", "owner_id": "u"}])
    ev = _checkout_event("evt_1", "wA", "subscription", "price_starter_test", sub="sub_1")
    run(billing_routes.stripe_webhook(_make_webhook_request(ev, db)))
    assert db.weddings["wA"]["plan"] == "premium"
    assert db.weddings["wA"]["stripe_subscription_id"] == "sub_1"


def test_webhook_lifetime_price_id_sets_lifetime():
    db = BillingFakeDB([{"id": "wB", "plan": "free", "owner_id": "u"}])
    ev = _checkout_event("evt_2", "wB", "payment", "price_lifetime_test")
    run(billing_routes.stripe_webhook(_make_webhook_request(ev, db)))
    assert db.weddings["wB"]["plan"] == "lifetime"


def test_webhook_subscription_deleted_downgrades_premium():
    db = BillingFakeDB([{"id": "wC", "plan": "premium", "owner_id": "u", "stripe_subscription_id": "sub_c"}])
    ev = {"id": "evt_3", "type": "customer.subscription.deleted",
          "data": {"object": {"id": "sub_c"}}}
    run(billing_routes.stripe_webhook(_make_webhook_request(ev, db)))
    assert db.weddings["wC"]["plan"] == "free"


def test_webhook_subscription_deleted_never_downgrades_lifetime():
    db = BillingFakeDB([{"id": "wD", "plan": "lifetime", "owner_id": "u", "stripe_subscription_id": "sub_d"}])
    ev = {"id": "evt_4", "type": "customer.subscription.deleted",
          "data": {"object": {"id": "sub_d"}}}
    run(billing_routes.stripe_webhook(_make_webhook_request(ev, db)))
    assert db.weddings["wD"]["plan"] == "lifetime"  # untouched


def test_webhook_invoice_payment_failed_keeps_premium():
    db = BillingFakeDB([{"id": "wE", "plan": "premium", "owner_id": "u", "stripe_subscription_id": "sub_e"}])
    ev = {"id": "evt_5", "type": "invoice.payment_failed",
          "data": {"object": {"subscription": "sub_e"}}}
    run(billing_routes.stripe_webhook(_make_webhook_request(ev, db)))
    # Dunning window — not downgraded yet.
    assert db.weddings["wE"]["plan"] == "premium"


def test_webhook_duplicate_event_id_is_noop():
    db = BillingFakeDB([{"id": "wF", "plan": "premium", "owner_id": "u", "stripe_subscription_id": "sub_f"}])
    ev = {"id": "evt_dup", "type": "customer.subscription.deleted",
          "data": {"object": {"id": "sub_f"}}}
    run(billing_routes.stripe_webhook(_make_webhook_request(ev, db)))
    assert db.weddings["wF"]["plan"] == "free"
    # Re-arm the plan, then replay the same event id — must be ignored.
    db.weddings["wF"]["plan"] = "premium"
    out = run(billing_routes.stripe_webhook(_make_webhook_request(ev, db)))
    assert out.get("duplicate") is True
    assert db.weddings["wF"]["plan"] == "premium"


def test_webhook_unknown_price_id_is_noop():
    db = BillingFakeDB([{"id": "wG", "plan": "premium", "owner_id": "u", "stripe_subscription_id": "sub_g"}])
    ev = {"id": "evt_6", "type": "customer.subscription.updated",
          "data": {"object": {"id": "sub_g", "status": "active",
                               "items": {"data": [{"price": {"id": "price_unknown"}}]}}}}
    run(billing_routes.stripe_webhook(_make_webhook_request(ev, db)))
    assert db.weddings["wG"]["plan"] == "premium"  # unchanged — never guessed


def test_seen_event_raises_loud_when_table_missing():
    class _NoTableDB:
        def prepare(self, sql):
            class S:
                def bind(self, *a):
                    return self
                async def first(self):
                    raise Exception("no such table: stripe_events")
            return S()
    with pytest.raises(billing_routes._StripeEventsMissing):
        run(billing_routes._seen_event(_NoTableDB(), "evt_x"))


# ---------------------------------------------------------------------------
# Price-id -> plan mapping reads from env (sandbox ids as defaults)
# ---------------------------------------------------------------------------

def test_price_plan_map_reads_premium_and_lifetime_from_env(monkeypatch):
    # Live ids configured purely via env — no code change vs. sandbox.
    monkeypatch.setenv("STRIPE_PREMIUM_PRICE_ID", "price_live_premium")
    monkeypatch.setenv("STRIPE_LIFETIME_PRICE_ID", "price_live_lifetime")
    monkeypatch.delenv("STRIPE_MONTHLY_PRICE_ID", raising=False)
    monkeypatch.delenv("STRIPE_STARTER_PRICE_ID", raising=False)
    assert billing_routes._plan_for_price("price_live_premium") == "premium"
    assert billing_routes._plan_for_price("price_live_lifetime") == "lifetime"
    # Sandbox defaults still resolve (env extends the map, never replaces it).
    assert billing_routes._plan_for_price(billing_routes._PREMIUM_PRICE_ID) == "premium"
    assert billing_routes._plan_for_price(billing_routes._LIFETIME_PRICE_ID) == "lifetime"
    # An unknown price id is never guessed.
    assert billing_routes._plan_for_price("price_who_knows") is None


def test_checkout_price_prefers_env_over_default(monkeypatch):
    monkeypatch.setenv("STRIPE_PREMIUM_PRICE_ID", "price_live_premium")
    monkeypatch.setenv("STRIPE_LIFETIME_PRICE_ID", "price_live_lifetime")
    assert billing_routes._checkout_price("premium") == ("price_live_premium", "subscription")
    assert billing_routes._checkout_price("lifetime") == ("price_live_lifetime", "payment")


def test_checkout_price_falls_back_to_sandbox_default(monkeypatch):
    monkeypatch.delenv("STRIPE_PREMIUM_PRICE_ID", raising=False)
    monkeypatch.delenv("STRIPE_LIFETIME_PRICE_ID", raising=False)
    assert billing_routes._checkout_price("premium") == (billing_routes._PREMIUM_PRICE_ID, "subscription")
    assert billing_routes._checkout_price("lifetime") == (billing_routes._LIFETIME_PRICE_ID, "payment")
