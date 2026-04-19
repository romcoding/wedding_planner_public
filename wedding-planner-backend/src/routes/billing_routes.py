"""
Stripe billing routes.
POST /api/billing/create-checkout-session
POST /api/billing/webhook
GET  /api/billing/portal
GET  /api/billing/status
"""
import os
import logging
from fastapi import APIRouter, Request, Depends, HTTPException
from pydantic import BaseModel
from src.middleware import get_db, get_wedding, PLAN_LIMITS

logger = logging.getLogger(__name__)
router = APIRouter()

STRIPE_SECRET_KEY = os.environ.get("STRIPE_SECRET_KEY", "")
STRIPE_WEBHOOK_SECRET = os.environ.get("STRIPE_WEBHOOK_SECRET", "")
STRIPE_STARTER_PRICE_ID = os.environ.get("STRIPE_STARTER_PRICE_ID", "")
STRIPE_PREMIUM_PRICE_ID = os.environ.get("STRIPE_PREMIUM_PRICE_ID", "")
FRONTEND_URL = os.environ.get("FRONTEND_URL", "http://localhost:5173")


def _get_stripe():
    import stripe as _stripe
    _stripe.api_key = STRIPE_SECRET_KEY
    return _stripe


def _plan_from_price_id(price_id: str) -> str:
    if price_id == STRIPE_PREMIUM_PRICE_ID:
        return "premium"
    if price_id == STRIPE_STARTER_PRICE_ID:
        return "starter"
    return "free"


class CheckoutBody(BaseModel):
    plan: str = "starter"


@router.post("/create-checkout-session")
async def create_checkout_session(
    body: CheckoutBody,
    wedding: dict = Depends(get_wedding),
    request: Request = None,
):
    if not STRIPE_SECRET_KEY:
        raise HTTPException(503, "Stripe is not configured on this server")

    if body.plan not in ("starter", "premium"):
        raise HTTPException(400, 'plan must be "starter" or "premium"')

    price_id = STRIPE_STARTER_PRICE_ID if body.plan == "starter" else STRIPE_PREMIUM_PRICE_ID
    if not price_id:
        raise HTTPException(503, f"Price ID for {body.plan} plan is not configured")

    db = await get_db(request)
    stripe = _get_stripe()
    wedding_id = wedding["id"]

    # Get owner email
    user = await db.prepare("SELECT email, name FROM users WHERE id = ?").bind(wedding["owner_id"]).first()
    email = user["email"] if user else ""
    name = user["name"] if user else (wedding.get("partner_one_name") or "")

    # Create or reuse Stripe customer
    customer_id = wedding.get("stripe_customer_id")
    if not customer_id:
        customer = stripe.Customer.create(
            email=email,
            name=name,
            metadata={"wedding_id": wedding_id, "slug": wedding.get("slug", "")},
        )
        customer_id = customer.id
        await db.prepare(
            "UPDATE weddings SET stripe_customer_id = ?, updated_at = datetime('now') WHERE id = ?"
        ).bind(customer_id, wedding_id).run()

    try:
        session = stripe.checkout.Session.create(
            customer=customer_id,
            mode="subscription",
            line_items=[{"price": price_id, "quantity": 1}],
            success_url=f"{FRONTEND_URL}/admin/billing?session_id={{CHECKOUT_SESSION_ID}}&status=success",
            cancel_url=f"{FRONTEND_URL}/admin/billing?status=cancelled",
            metadata={"wedding_id": wedding_id, "plan": body.plan},
            subscription_data={"metadata": {"wedding_id": wedding_id}},
        )
    except Exception as e:
        logger.error(f"Stripe checkout error for wedding {wedding_id}: {e}")
        raise HTTPException(500, f"Failed to create checkout session: {str(e)}")

    return {"checkout_url": session.url, "session_id": session.id}


@router.post("/webhook")
async def stripe_webhook(request: Request):
    if not STRIPE_WEBHOOK_SECRET:
        raise HTTPException(503, "Webhook secret not configured")

    stripe = _get_stripe()
    payload = await request.body()
    sig_header = request.headers.get("Stripe-Signature", "")

    try:
        event = stripe.Webhook.construct_event(payload, sig_header, STRIPE_WEBHOOK_SECRET)
    except stripe.error.SignatureVerificationError:
        logger.warning("Invalid Stripe webhook signature")
        raise HTTPException(400, "Invalid signature")
    except Exception as e:
        raise HTTPException(400, str(e))

    db = await get_db(request)
    event_type = event["type"]
    obj = event["data"]["object"]

    if event_type == "checkout.session.completed":
        await _handle_checkout_completed(db, obj)
    elif event_type in ("customer.subscription.updated", "customer.subscription.created"):
        await _handle_subscription_updated(db, obj)
    elif event_type == "customer.subscription.deleted":
        await _handle_subscription_deleted(db, obj)

    return {"received": True}


async def _handle_checkout_completed(db, session):
    wedding_id = session.get("metadata", {}).get("wedding_id")
    if not wedding_id:
        return
    plan = session.get("metadata", {}).get("plan", "starter")
    subscription_id = session.get("subscription")
    await db.prepare(
        "UPDATE weddings SET plan = ?, stripe_subscription_id = COALESCE(?, stripe_subscription_id), "
        "is_active = 1, updated_at = datetime('now') WHERE id = ?"
    ).bind(plan, subscription_id, wedding_id).run()
    logger.info(f"Wedding {wedding_id} upgraded to {plan}")


async def _handle_subscription_updated(db, subscription):
    wedding_id = subscription.get("metadata", {}).get("wedding_id")
    if not wedding_id:
        row = await db.prepare(
            "SELECT id FROM weddings WHERE stripe_subscription_id = ?"
        ).bind(subscription["id"]).first()
        if row:
            wedding_id = row["id"]

    if not wedding_id:
        return

    status = subscription.get("status")
    items = subscription.get("items", {}).get("data", [])
    price_id = items[0]["price"]["id"] if items else None
    new_plan = _plan_from_price_id(price_id) if price_id else "free"
    is_active = 1 if status in ("active", "trialing") else 0

    await db.prepare(
        "UPDATE weddings SET plan = ?, stripe_subscription_id = ?, is_active = ?, "
        "updated_at = datetime('now') WHERE id = ?"
    ).bind(new_plan, subscription["id"], is_active, wedding_id).run()


async def _handle_subscription_deleted(db, subscription):
    row = await db.prepare(
        "SELECT id FROM weddings WHERE stripe_subscription_id = ?"
    ).bind(subscription["id"]).first()
    if not row:
        return
    await db.prepare(
        "UPDATE weddings SET plan = 'free', stripe_subscription_id = NULL, "
        "is_active = 1, updated_at = datetime('now') WHERE id = ?"
    ).bind(row["id"]).run()


@router.get("/portal")
async def billing_portal(
    wedding: dict = Depends(get_wedding),
    request: Request = None,
):
    if not STRIPE_SECRET_KEY:
        raise HTTPException(503, "Stripe is not configured")

    customer_id = wedding.get("stripe_customer_id")
    if not customer_id:
        raise HTTPException(404, "No Stripe customer found. Please subscribe to a plan first.")

    stripe = _get_stripe()
    try:
        portal = stripe.billing_portal.Session.create(
            customer=customer_id,
            return_url=f"{FRONTEND_URL}/admin/billing",
        )
    except Exception as e:
        raise HTTPException(500, f"Failed to create portal session: {str(e)}")

    return {"portal_url": portal.url}


@router.get("/status")
async def billing_status(wedding: dict = Depends(get_wedding)):
    plan = wedding.get("plan", "free")
    return {
        "plan": plan,
        "is_active": bool(wedding.get("is_active", 1)),
        "stripe_customer_id": wedding.get("stripe_customer_id"),
        "stripe_subscription_id": wedding.get("stripe_subscription_id"),
        "limits": PLAN_LIMITS.get(plan, {}),
    }
