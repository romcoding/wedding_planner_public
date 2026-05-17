"""
Stripe routes (Market Entry Layer spec).

Endpoints:
  POST /api/stripe/checkout   — Admin JWT; create a Checkout Session
  GET  /api/stripe/status     — Admin JWT; current plan + subscription info
  POST /api/stripe/webhook    — No JWT; HMAC-SHA256 signature verified

These coexist with the legacy /api/billing/* routes — both are wired up so
existing clients keep working while new clients follow the spec naming.
"""

import os
import json
import hmac
import hashlib
import logging
import time

from fastapi import APIRouter, Request, Depends, HTTPException
from pydantic import BaseModel

from middleware import get_db, get_wedding
from services.stripe_service import create_customer, create_checkout_session

logger = logging.getLogger(__name__)
router = APIRouter()


def _env(key: str, default: str = "") -> str:
    return os.environ.get(key, default)


# Known price-id → (plan, mode) map. Built lazily so env mirroring (done in
# main.py for each request) is visible by the time we read it.
def _price_catalog() -> dict[str, tuple[str, str]]:
    """Return {price_id: (plan_label, checkout_mode)} for all configured prices."""
    catalog: dict[str, tuple[str, str]] = {}
    for env_key, plan, mode in (
        ("STRIPE_STARTER_PRICE_ID", "starter", "subscription"),
        ("STRIPE_PREMIUM_PRICE_ID", "premium", "subscription"),
        ("STRIPE_MONTHLY_PRICE_ID", "premium", "subscription"),
        ("STRIPE_LIFETIME_PRICE_ID", "premium", "payment"),
    ):
        pid = _env(env_key)
        if pid:
            catalog[pid] = (plan, mode)
    return catalog


# ---------- Webhook signature verification (HMAC-SHA256) ----------


def _verify_stripe_signature(payload: bytes, sig_header: str, secret: str, tolerance: int = 300) -> bool:
    """Verify a Stripe webhook signature header.

    Stripe sends: `t=<timestamp>,v1=<signature>,v0=<legacy>`
    Compute HMAC-SHA256 over `{timestamp}.{payload}` and compare to v1.
    """
    if not sig_header or not secret:
        return False

    parts: dict[str, list[str]] = {}
    for piece in sig_header.split(","):
        if "=" in piece:
            k, _, v = piece.partition("=")
            parts.setdefault(k.strip(), []).append(v.strip())

    timestamp = parts.get("t", [None])[0]
    candidates = parts.get("v1", [])
    if not timestamp or not candidates:
        return False

    try:
        if abs(time.time() - int(timestamp)) > tolerance:
            return False
    except ValueError:
        return False

    signed = f"{timestamp}.".encode() + payload
    expected = hmac.new(secret.encode(), signed, hashlib.sha256).hexdigest()
    return any(hmac.compare_digest(expected, c) for c in candidates)


# ---------- Idempotency ----------


async def _seen_event(db, event_id: str) -> bool:
    if not event_id:
        return False
    try:
        row = await db.prepare("SELECT id FROM stripe_events WHERE id = ?").bind(event_id).first()
        return row is not None
    except Exception:
        return False


async def _mark_event_seen(db, event_id: str, event_type: str) -> None:
    if not event_id:
        return
    try:
        await db.prepare(
            "INSERT OR IGNORE INTO stripe_events (id, event_type, processed_at) "
            "VALUES (?, ?, datetime('now'))"
        ).bind(event_id, event_type or "").run()
    except Exception as exc:
        logger.warning(f"[stripe] failed to record event {event_id}: {exc}")


# ---------- Pydantic models ----------


class CheckoutBody(BaseModel):
    price_id: str | None = None
    plan: str | None = None  # accepted as a fallback (legacy/onboarding)
    success_url: str | None = None
    cancel_url: str | None = None


# ---------- Routes ----------


@router.post("/checkout")
async def stripe_checkout(
    body: CheckoutBody,
    wedding: dict = Depends(get_wedding),
    request: Request = None,
):
    """Create a Stripe Checkout session for the current wedding."""
    catalog = _price_catalog()

    # Resolve price_id either directly or via legacy plan-name lookup.
    price_id = (body.price_id or "").strip() or None
    mode: str | None = None

    if price_id:
        if price_id not in catalog:
            raise HTTPException(400, "Unknown price_id")
        _, mode = catalog[price_id]
    elif body.plan:
        plan_to_env = {
            "starter": "STRIPE_STARTER_PRICE_ID",
            "premium": "STRIPE_PREMIUM_PRICE_ID",
            "monthly": "STRIPE_MONTHLY_PRICE_ID",
            "lifetime": "STRIPE_LIFETIME_PRICE_ID",
        }
        env_key = plan_to_env.get(body.plan.lower())
        if not env_key:
            raise HTTPException(400, 'plan must be one of "starter", "premium", "monthly", "lifetime"')
        price_id = _env(env_key)
        if not price_id:
            raise HTTPException(503, f"Price ID for {body.plan} plan is not configured")
        mode = catalog.get(price_id, (None, "subscription"))[1]
    else:
        raise HTTPException(400, "price_id or plan is required")

    db = await get_db(request)
    env = request.scope["env"]
    wedding_id = wedding["id"]

    owner_raw = await db.prepare(
        "SELECT email, name FROM users WHERE id = ?"
    ).bind(wedding["owner_id"]).first()
    owner = dict(owner_raw) if owner_raw else None
    email = owner.get("email", "") if owner else ""
    name = owner.get("name", "") if owner else (wedding.get("partner_one_name") or "")

    # Re-use or create the Stripe customer for this wedding.
    customer_id = wedding.get("stripe_customer_id")
    if not customer_id:
        customer_id = await create_customer(
            env,
            email=email,
            name=name,
            metadata={"wedding_id": wedding_id, "slug": wedding.get("slug", "")},
        )
        await db.prepare(
            "UPDATE weddings SET stripe_customer_id = ?, updated_at = datetime('now') WHERE id = ?"
        ).bind(customer_id, wedding_id).run()

    frontend_url = _env("FRONTEND_URL", "http://localhost:5173")
    success_url = body.success_url or f"{frontend_url}/admin/billing?upgraded=true&session_id={{CHECKOUT_SESSION_ID}}"
    cancel_url = body.cancel_url or f"{frontend_url}/admin/billing?status=cancelled"

    checkout_url = await create_checkout_session(
        env,
        customer_id=customer_id,
        price_id=price_id,
        wedding_id=wedding_id,
        success_url=success_url,
        cancel_url=cancel_url,
        mode=mode or "subscription",
    )
    return {"checkout_url": checkout_url}


@router.get("/status")
async def stripe_status(wedding: dict = Depends(get_wedding)):
    """Return the current plan + subscription info for the wedding."""
    return {
        "plan": wedding.get("plan", "free"),
        "subscription_id": wedding.get("stripe_subscription_id"),
        "expires_at": wedding.get("plan_expires_at"),
    }


@router.post("/webhook")
async def stripe_webhook(request: Request):
    """Process Stripe webhook events. HMAC-SHA256 verified, idempotent."""
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

    if await _seen_event(db, event_id):
        return {"received": True, "duplicate": True}

    obj = event.get("data", {}).get("object", {}) or {}

    try:
        if event_type == "checkout.session.completed":
            await _handle_checkout_completed(db, obj)
        elif event_type == "customer.subscription.deleted":
            await _handle_subscription_deleted(db, obj)
        else:
            logger.debug(f"[stripe] unhandled event type: {event_type}")
    finally:
        await _mark_event_seen(db, event_id, event_type)

    return {"received": True}


async def _handle_checkout_completed(db, session: dict) -> None:
    wedding_id = session.get("client_reference_id") or (session.get("metadata") or {}).get("wedding_id")
    if not wedding_id:
        return

    customer_id = session.get("customer")
    subscription_id = session.get("subscription")
    mode = session.get("mode")

    if mode == "payment":
        # Lifetime / one-time purchase.
        await db.prepare(
            "UPDATE weddings SET plan = 'premium', "
            "stripe_customer_id = COALESCE(?, stripe_customer_id), "
            "plan_expires_at = '2099-12-31', "
            "is_active = 1, updated_at = datetime('now') WHERE id = ?"
        ).bind(customer_id, wedding_id).run()
    else:
        await db.prepare(
            "UPDATE weddings SET plan = 'premium', "
            "stripe_customer_id = COALESCE(?, stripe_customer_id), "
            "stripe_subscription_id = COALESCE(?, stripe_subscription_id), "
            "is_active = 1, updated_at = datetime('now') WHERE id = ?"
        ).bind(customer_id, subscription_id, wedding_id).run()

    logger.info(f"[stripe] wedding {wedding_id} upgraded to premium (mode={mode})")

    # Welcome-to-premium email (fire-and-forget).
    try:
        wed_raw = await db.prepare(
            "SELECT w.partner_one_name, w.partner_two_name, u.email "
            "FROM weddings w JOIN users u ON u.id = w.owner_id WHERE w.id = ?"
        ).bind(wedding_id).first()
        wed = dict(wed_raw) if wed_raw else None
        if wed:
            from services.email_service import send_upgrade_confirmation_email
            couple = " & ".join(filter(None, [wed.get("partner_one_name"), wed.get("partner_two_name")])) or "there"
            plan_type = "lifetime" if mode == "payment" else "premium"
            await send_upgrade_confirmation_email(wed.get("email"), couple, plan_type)
    except Exception as exc:
        logger.warning(f"[stripe] failed to send upgrade email for {wedding_id}: {exc}")


async def _handle_subscription_deleted(db, subscription: dict) -> None:
    row = await db.prepare(
        "SELECT id, owner_id FROM weddings WHERE stripe_subscription_id = ?"
    ).bind(subscription.get("id")).first()
    if not row:
        return

    await db.prepare(
        "UPDATE weddings SET plan = 'free', stripe_subscription_id = NULL, "
        "is_active = 1, updated_at = datetime('now') WHERE id = ?"
    ).bind(row["id"]).run()

    try:
        owner = await db.prepare(
            "SELECT email, name FROM users WHERE id = ?"
        ).bind(row["owner_id"]).first()
        if owner:
            from services.email_service import send_subscription_cancelled_email
            await send_subscription_cancelled_email(owner["email"], owner.get("name") or "there")
    except Exception as exc:
        logger.warning(f"[stripe] failed to send cancellation email: {exc}")
