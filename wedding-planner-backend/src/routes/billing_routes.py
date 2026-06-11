"""
Stripe billing routes.

POST /api/billing/create-checkout-session  — Start a Stripe Checkout (subscription or one-time)
POST /api/billing/webhook                  — Stripe webhook handler (HMAC-SHA256 verified)
GET  /api/billing/status                   — Current plan + subscription info for the wedding
GET  /api/billing/portal                   — Returns a Stripe Customer Portal URL

All Stripe API calls go through httpx so the route file is Pyodide-compatible —
the official `stripe` Python SDK is NOT installed in the Worker bundle.
"""

import os
import json
import hmac
import hashlib
import logging
import time
import urllib.parse
from typing import Any

import httpx
from fastapi import APIRouter, Request, Depends, HTTPException
from pydantic import BaseModel

from middleware import get_db, get_wedding
from entitlements import get_limits

logger = logging.getLogger(__name__)
from db import row_to_dict, rows_to_list

router = APIRouter()

STRIPE_API_BASE = "https://api.stripe.com/v1"


def _env(key: str, default: str = "") -> str:
    return os.environ.get(key, default)


# ---------- Stripe HTTP helpers ----------


async def _stripe_post(path: str, form: dict) -> dict:
    """POST application/x-www-form-urlencoded to the Stripe API."""
    secret = _env("STRIPE_SECRET_KEY")
    if not secret:
        raise HTTPException(503, "Stripe is not configured on this server")

    payload = urllib.parse.urlencode(_flatten_form(form), doseq=True)
    async with httpx.AsyncClient(timeout=20.0) as client:
        resp = await client.post(
            f"{STRIPE_API_BASE}{path}",
            content=payload,
            headers={
                "Authorization": f"Bearer {secret}",
                "Content-Type": "application/x-www-form-urlencoded",
            },
        )
    if resp.status_code >= 400:
        try:
            err = resp.json().get("error", {})
            msg = err.get("message") or err.get("type") or resp.text
        except Exception:
            msg = resp.text
        logger.error(f"Stripe API {path} failed: {resp.status_code} {msg}")
        raise HTTPException(502, "Payment provider error. Please try again later.")
    return resp.json()


def _flatten_form(data: Any, prefix: str = "") -> list[tuple[str, str]]:
    """Convert a nested dict/list (Stripe-style) into form-encoded key/value pairs.

    Stripe expects things like `line_items[0][price]=price_xxx` — this helper
    walks dicts/lists and produces the right bracketed keys.
    """
    out: list[tuple[str, str]] = []
    if isinstance(data, dict):
        for k, v in data.items():
            key = f"{prefix}[{k}]" if prefix else k
            out.extend(_flatten_form(v, key))
    elif isinstance(data, list):
        for i, v in enumerate(data):
            key = f"{prefix}[{i}]"
            out.extend(_flatten_form(v, key))
    elif data is None:
        return out
    elif isinstance(data, bool):
        out.append((prefix, "true" if data else "false"))
    else:
        out.append((prefix, str(data)))
    return out


# ---------- Webhook signature verification (HMAC-SHA256) ----------


def _verify_stripe_signature(payload: bytes, sig_header: str, secret: str, tolerance: int = 300) -> bool:
    """Verify a Stripe webhook signature header.

    Stripe sends: `t=<timestamp>,v1=<signature>,v0=<legacy>`
    We compute HMAC-SHA256 over `{timestamp}.{payload}` and compare to v1.
    """
    if not sig_header or not secret:
        return False

    parts = {}
    for piece in sig_header.split(","):
        if "=" in piece:
            k, _, v = piece.partition("=")
            parts.setdefault(k.strip(), []).append(v.strip())

    timestamp = parts.get("t", [None])[0]
    candidates = parts.get("v1", [])
    if not timestamp or not candidates:
        return False

    # Reject events outside the freshness window
    try:
        if abs(time.time() - int(timestamp)) > tolerance:
            return False
    except ValueError:
        return False

    signed = f"{timestamp}.".encode() + payload
    expected = hmac.new(secret.encode(), signed, hashlib.sha256).hexdigest()
    return any(hmac.compare_digest(expected, c) for c in candidates)


# ---------- Helpers ----------


# Known production price ids for the consolidated tiers. Env vars (if set)
# extend/override this map; an unknown price id maps to None (never guessed).
_PREMIUM_PRICE_ID = "price_1TXkacDTUwCAfgW5yZgz8fwC"   # CHF 9/mo subscription
_LIFETIME_PRICE_ID = "price_1TXkahDTUwCAfgW5KURJ4UN4"  # one-time lifetime


def _price_plan_map() -> dict[str, str]:
    """Map known price ids -> plan. Built per-call so env mirroring is visible."""
    mapping: dict[str, str] = {
        _PREMIUM_PRICE_ID: "premium",
        _LIFETIME_PRICE_ID: "lifetime",
    }
    for env_key, plan in (
        ("STRIPE_PREMIUM_PRICE_ID", "premium"),
        ("STRIPE_MONTHLY_PRICE_ID", "premium"),
        ("STRIPE_STARTER_PRICE_ID", "premium"),  # retired starter collapses to premium
        ("STRIPE_LIFETIME_PRICE_ID", "lifetime"),
    ):
        pid = _env(env_key)
        if pid:
            mapping[pid] = plan
    return mapping


def _plan_for_price(price_id: str | None) -> str | None:
    """Resolve a price id to a plan, or None if it is unknown (never guess)."""
    if not price_id:
        return None
    return _price_plan_map().get(price_id)


def _checkout_price(plan: str) -> tuple[str, str]:
    """Return (price_id, checkout_mode) for a requested plan."""
    if plan == "premium":
        return (_env("STRIPE_PREMIUM_PRICE_ID") or _PREMIUM_PRICE_ID, "subscription")
    return (_env("STRIPE_LIFETIME_PRICE_ID") or _LIFETIME_PRICE_ID, "payment")


class _StripeEventsMissing(Exception):
    """Raised when the stripe_events idempotency table is absent."""


async def _seen_event(db, event_id: str) -> bool:
    """Idempotency check — True if this event id was already processed.

    The stripe_events table is guaranteed by schema.sql. If it is somehow
    missing we FAIL LOUDLY rather than silently disabling idempotency (which
    would let duplicate events double-process plan writes / emails).
    """
    if not event_id:
        return False
    try:
        row_raw = await db.prepare("SELECT id FROM stripe_events WHERE id = ?").bind(event_id).first()
        return row_raw is not None
    except Exception as exc:
        if "no such table" in str(exc).lower():
            logger.error("[stripe] stripe_events table missing — idempotency unavailable")
            raise _StripeEventsMissing() from exc
        raise


async def _mark_event_seen(db, event_id: str, event_type: str) -> None:
    if not event_id:
        return
    try:
        await db.prepare(
            "INSERT OR IGNORE INTO stripe_events (id, event_type, processed_at) VALUES (?, ?, datetime('now'))"
        ).bind(event_id, event_type or "").run()
    except Exception as exc:
        logger.warning(f"[stripe] failed to record event {event_id}: {exc}")


# ---------- Pydantic models ----------


class CheckoutBody(BaseModel):
    plan: str = "premium"  # "premium" | "lifetime"
    success_url: str | None = None
    cancel_url: str | None = None


# ---------- Routes ----------


@router.post("/create-checkout-session")
async def create_checkout_session(
    body: CheckoutBody,
    wedding: dict = Depends(get_wedding),
    request: Request = None,
):
    """Create a Stripe Checkout session for upgrading.

    Body: { plan: "premium"|"lifetime", success_url?, cancel_url? }
    """
    plan = "premium" if body.plan == "starter" else body.plan  # retired starter -> premium
    if plan not in ("premium", "lifetime"):
        raise HTTPException(400, 'plan must be "premium" or "lifetime"')

    price_id, mode = _checkout_price(plan)
    if not price_id:
        raise HTTPException(503, f"Price ID for {plan} plan is not configured")

    db = await get_db(request)
    wedding_id = wedding["id"]

    user_raw = await db.prepare("SELECT email, name FROM users WHERE id = ?").bind(wedding["owner_id"]).first()
    user = row_to_dict(user_raw)
    email = user.get("email") if user else ""
    name = user.get("name") if user else (wedding.get("partner_one_name") or "")

    # Create or reuse Stripe customer
    customer_id = wedding.get("stripe_customer_id")
    if not customer_id:
        customer = await _stripe_post(
            "/customers",
            {
                "email": email,
                "name": name,
                "metadata": {"wedding_id": wedding_id, "slug": wedding.get("slug", "")},
            },
        )
        customer_id = customer["id"]
        await db.prepare(
            "UPDATE weddings SET stripe_customer_id = ?, updated_at = datetime('now') WHERE id = ?"
        ).bind(customer_id, wedding_id).run()

    frontend_url = _env("FRONTEND_URL", "http://localhost:5173")
    success_url = body.success_url or (
        f"{frontend_url}/admin/billing?session_id={{CHECKOUT_SESSION_ID}}&status=success"
    )
    cancel_url = body.cancel_url or f"{frontend_url}/admin/billing?status=cancelled"

    session_form: dict[str, Any] = {
        "customer": customer_id,
        "mode": mode,
        "line_items": [{"price": price_id, "quantity": 1}],
        "success_url": success_url,
        "cancel_url": cancel_url,
        "client_reference_id": wedding_id,
        "metadata": {"wedding_id": wedding_id, "plan": plan, "price_id": price_id},
    }
    if mode == "subscription":
        session_form["subscription_data"] = {"metadata": {"wedding_id": wedding_id, "plan": plan}}
    else:
        session_form["payment_intent_data"] = {"metadata": {"wedding_id": wedding_id, "plan": plan}}

    session = await _stripe_post("/checkout/sessions", session_form)
    return {"checkout_url": session.get("url"), "session_id": session.get("id")}


@router.post("/webhook")
async def stripe_webhook(request: Request):
    """Process Stripe webhook events.

    No JWT — Stripe authenticates via the `Stripe-Signature` header which we
    verify with HMAC-SHA256 against `STRIPE_WEBHOOK_SECRET`.
    """
    webhook_secret = _env("STRIPE_WEBHOOK_SECRET")
    if not webhook_secret:
        raise HTTPException(503, "Webhook secret not configured")

    raw = await request.body()
    sig_header = request.headers.get("Stripe-Signature", "")

    if not _verify_stripe_signature(raw, sig_header, webhook_secret):
        logger.warning("[stripe] invalid webhook signature")
        raise HTTPException(400, "Invalid signature")

    try:
        event = json.loads(raw.decode("utf-8"))
    except Exception:
        raise HTTPException(400, "Invalid JSON payload")

    db = await get_db(request)
    event_id = event.get("id", "")
    event_type = event.get("type", "")

    try:
        if await _seen_event(db, event_id):
            return {"received": True, "duplicate": True}
    except _StripeEventsMissing:
        # Idempotency is mandatory — never silently process without it.
        raise HTTPException(500, "Webhook idempotency store unavailable")

    obj = event.get("data", {}).get("object", {}) or {}

    try:
        if event_type == "checkout.session.completed":
            await _handle_checkout_completed(db, obj)
        elif event_type in ("customer.subscription.updated", "customer.subscription.created"):
            await _handle_subscription_updated(db, obj)
        elif event_type == "customer.subscription.deleted":
            await _handle_subscription_deleted(db, obj)
        elif event_type == "invoice.payment_failed":
            await _handle_payment_failed(db, obj)
        else:
            logger.info(f"[stripe] unhandled event type: {event_type}")
    finally:
        await _mark_event_seen(db, event_id, event_type)

    return {"received": True}


def _epoch_to_date(epoch) -> str | None:
    """Convert a Stripe unix timestamp to a YYYY-MM-DD date string."""
    try:
        from datetime import datetime, timezone
        return datetime.fromtimestamp(int(epoch), tz=timezone.utc).strftime("%Y-%m-%d")
    except (TypeError, ValueError, OSError):
        return None


async def _stored_plan(db, wedding_id: str) -> str | None:
    raw = await db.prepare("SELECT plan FROM weddings WHERE id = ?").bind(wedding_id).first()
    return (row_to_dict(raw) or {}).get("plan")


async def _unpublish_sites(db, wedding_id: str) -> None:
    """On downgrade to free, unpublish any public wedding_sites row.

    Forward-declared for Phase 4 — guarded so it is inert until the
    wedding_sites table exists.
    """
    try:
        await db.prepare(
            "UPDATE wedding_sites SET status = 'unpublished' WHERE wedding_id = ?"
        ).bind(wedding_id).run()
        logger.info(f"[stripe] wedding {wedding_id}: wedding_sites unpublished")
    except Exception as exc:
        if "no such table" in str(exc).lower():
            return  # table not present yet — inert until P4 ships it
        logger.warning(f"[stripe] failed to unpublish sites for {wedding_id}: {exc}")


async def _downgrade_to_free(db, wedding_id: str, reason: str = "") -> None:
    """Downgrade a wedding to free. NEVER downgrades a lifetime wedding."""
    if await _stored_plan(db, wedding_id) == "lifetime":
        logger.info(f"[stripe] wedding {wedding_id}: lifetime — refusing downgrade ({reason})")
        return
    await db.prepare(
        "UPDATE weddings SET plan = 'free', stripe_subscription_id = NULL, "
        "plan_expires_at = NULL, plan_updated_at = datetime('now'), "
        "is_active = 1, updated_at = datetime('now') WHERE id = ?"
    ).bind(wedding_id).run()
    logger.info(f"[stripe] wedding {wedding_id} downgraded to free ({reason})")
    await _unpublish_sites(db, wedding_id)


async def _handle_checkout_completed(db, session: dict) -> None:
    """Sync plan after successful checkout (subscription -> premium, payment -> lifetime)."""
    wedding_id = session.get("client_reference_id") or (session.get("metadata") or {}).get("wedding_id")
    if not wedding_id:
        logger.warning("[stripe] checkout.session.completed without wedding_id")
        return

    customer_id = session.get("customer")
    subscription_id = session.get("subscription")
    mode = session.get("mode")
    meta = session.get("metadata") or {}

    # Resolve plan by price id first (never guess); fall back to checkout mode,
    # then to a validated metadata plan.
    plan = _plan_for_price(meta.get("price_id"))
    if plan is None:
        if mode == "payment":
            plan = "lifetime"
        elif mode == "subscription":
            plan = "premium"
        elif meta.get("plan") in ("premium", "lifetime"):
            plan = meta.get("plan")
    if plan is None:
        logger.warning(f"[stripe] checkout for {wedding_id}: cannot resolve plan (mode={mode}); no-op")
        return

    if plan == "lifetime":
        await db.prepare(
            "UPDATE weddings SET plan = 'lifetime', "
            "stripe_customer_id = COALESCE(?, stripe_customer_id), "
            "plan_expires_at = '2099-12-31', plan_updated_at = datetime('now'), "
            "is_active = 1, updated_at = datetime('now') WHERE id = ?"
        ).bind(customer_id, wedding_id).run()
    else:  # premium subscription
        await db.prepare(
            "UPDATE weddings SET plan = 'premium', "
            "stripe_customer_id = COALESCE(?, stripe_customer_id), "
            "stripe_subscription_id = COALESCE(?, stripe_subscription_id), "
            "plan_expires_at = NULL, plan_updated_at = datetime('now'), "
            "is_active = 1, updated_at = datetime('now') WHERE id = ?"
        ).bind(customer_id, subscription_id, wedding_id).run()

    logger.info(f"[stripe] wedding {wedding_id} -> {plan} (checkout, mode={mode})")

    # Fire-and-forget welcome-to-premium email
    try:
        wed_row_raw = await db.prepare(
            "SELECT w.partner_one_name, w.partner_two_name, u.email "
            "FROM weddings w JOIN users u ON u.id = w.owner_id WHERE w.id = ?"
        ).bind(wedding_id).first()
        wed_row = row_to_dict(wed_row_raw)
        if wed_row:
            from services.email_service import send_upgrade_confirmation_email
            couple = " & ".join(filter(None, [wed_row.get("partner_one_name"), wed_row.get("partner_two_name")])) or "there"
            await send_upgrade_confirmation_email(wed_row.get("email"), couple, plan)
    except Exception as exc:
        logger.warning(f"[stripe] failed to send upgrade email for {wedding_id}: {exc}")


async def _handle_subscription_updated(db, subscription: dict) -> None:
    """Sync plan/status on subscription changes. Unknown price id is a no-op."""
    sub_id = subscription.get("id")
    wedding_id = (subscription.get("metadata") or {}).get("wedding_id")
    if not wedding_id and sub_id:
        row_raw = await db.prepare(
            "SELECT id FROM weddings WHERE stripe_subscription_id = ?"
        ).bind(sub_id).first()
        wedding_id = ((row_to_dict(row_raw) or {})).get("id")
    if not wedding_id:
        logger.warning("[stripe] subscription.updated without a resolvable wedding")
        return

    # Lifetime is immune to subscription state changes.
    if await _stored_plan(db, wedding_id) == "lifetime":
        logger.info(f"[stripe] wedding {wedding_id}: lifetime — ignoring subscription.updated")
        return

    status = subscription.get("status")

    # Terminal failure states -> downgrade (final retry exhausted).
    if status in ("canceled", "unpaid"):
        await _downgrade_to_free(db, wedding_id, reason=f"subscription.updated status={status}")
        return

    items = (subscription.get("items") or {}).get("data", [])
    price_id = items[0].get("price", {}).get("id") if items else None
    plan = _plan_for_price(price_id)
    if plan is None:
        logger.warning(f"[stripe] subscription.updated unknown price {price_id} for {wedding_id}; no-op")
        return

    # cancel_at_period_end: keep premium until the period ends.
    expires_at = None
    if subscription.get("cancel_at_period_end"):
        expires_at = _epoch_to_date(subscription.get("current_period_end"))
        logger.info(f"[stripe] wedding {wedding_id}: cancel_at_period_end, {plan} until {expires_at}")

    await db.prepare(
        "UPDATE weddings SET plan = ?, stripe_subscription_id = ?, plan_expires_at = ?, "
        "plan_updated_at = datetime('now'), is_active = 1, updated_at = datetime('now') WHERE id = ?"
    ).bind(plan, sub_id, expires_at, wedding_id).run()
    logger.info(f"[stripe] wedding {wedding_id} -> {plan} (subscription status={status})")


async def _handle_subscription_deleted(db, subscription: dict) -> None:
    """Downgrade premium -> free when a subscription is cancelled. Never lifetime."""
    sub_id = subscription.get("id")
    row_raw = await db.prepare(
        "SELECT id, owner_id, plan FROM weddings WHERE stripe_subscription_id = ?"
    ).bind(sub_id).first()
    row = row_to_dict(row_raw)
    if not row:
        logger.info(f"[stripe] subscription.deleted {sub_id}: no matching wedding")
        return

    wedding_id = row.get("id")
    if row.get("plan") == "lifetime":
        logger.info(f"[stripe] wedding {wedding_id}: lifetime — ignoring subscription.deleted")
        return

    await _downgrade_to_free(db, wedding_id, reason="subscription.deleted")

    try:
        owner_raw = await db.prepare(
            "SELECT email, name FROM users WHERE id = ?"
        ).bind(row.get("owner_id")).first()
        owner = row_to_dict(owner_raw)
        if owner:
            from services.email_service import send_subscription_cancelled_email
            await send_subscription_cancelled_email(owner.get("email"), owner.get("name") or "there")
    except Exception as exc:
        logger.warning(f"[stripe] failed to send cancellation email: {exc}")


async def _handle_payment_failed(db, invoice: dict) -> None:
    """invoice.payment_failed — mark past_due and log. Never downgrades here.

    Downgrade happens only when Stripe's final retry fails, surfaced as
    subscription.updated(canceled/unpaid) or subscription.deleted.
    """
    sub_id = invoice.get("subscription")
    wedding_id = None
    if sub_id:
        row_raw = await db.prepare(
            "SELECT id FROM weddings WHERE stripe_subscription_id = ?"
        ).bind(sub_id).first()
        wedding_id = ((row_to_dict(row_raw) or {})).get("id")
    if not wedding_id:
        logger.warning(f"[stripe] invoice.payment_failed: no wedding for subscription {sub_id}")
        return

    # Record the dunning transition without changing the plan (still premium
    # during Stripe's retry window).
    await db.prepare(
        "UPDATE weddings SET plan_updated_at = datetime('now'), updated_at = datetime('now') WHERE id = ?"
    ).bind(wedding_id).run()
    logger.info(f"[stripe] wedding {wedding_id}: invoice.payment_failed -> past_due (awaiting final retry)")


@router.get("/portal")
async def billing_portal(
    wedding: dict = Depends(get_wedding),
    request: Request = None,
):
    """Return a Stripe Customer Portal URL for self-service plan management."""
    customer_id = wedding.get("stripe_customer_id")
    if not customer_id:
        raise HTTPException(404, "No Stripe customer found. Please subscribe to a plan first.")

    frontend_url = _env("FRONTEND_URL", "http://localhost:5173")
    portal = await _stripe_post(
        "/billing_portal/sessions",
        {"customer": customer_id, "return_url": f"{frontend_url}/admin/billing"},
    )
    return {"portal_url": portal.get("url")}


@router.get("/status")
async def billing_status(wedding: dict = Depends(get_wedding)):
    plan = wedding.get("plan", "free")
    return {
        "plan": plan,
        "is_active": bool(wedding.get("is_active", 1)),
        "stripe_customer_id": wedding.get("stripe_customer_id"),
        "stripe_subscription_id": wedding.get("stripe_subscription_id"),
        "plan_expires_at": wedding.get("plan_expires_at"),
        "limits": get_limits(plan),
        "is_admin_override": bool(wedding.get("is_admin_override", False)),
    }
