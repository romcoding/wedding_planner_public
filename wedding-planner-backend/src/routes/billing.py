"""
Stripe billing routes.

POST /api/billing/create-checkout-session  — Start a Stripe Checkout for plan upgrade
POST /api/billing/webhook                  — Handle Stripe webhook events
GET  /api/billing/portal                   — Return Stripe Customer Portal URL
GET  /api/billing/status                   — Return current plan + subscription status
"""
import os
import logging
from flask import Blueprint, request, jsonify, g
from models import db
from models.wedding import Wedding
from utils.tenant import tenant_required

logger = logging.getLogger(__name__)
billing_bp = Blueprint('billing', __name__)

STRIPE_SECRET_KEY = os.getenv('STRIPE_SECRET_KEY', '')
STRIPE_WEBHOOK_SECRET = os.getenv('STRIPE_WEBHOOK_SECRET', '')
STRIPE_STARTER_PRICE_ID = os.getenv('STRIPE_STARTER_PRICE_ID', '')
STRIPE_PREMIUM_PRICE_ID = os.getenv('STRIPE_PREMIUM_PRICE_ID', '')
FRONTEND_URL = os.getenv('FRONTEND_URL', 'http://localhost:5173')


def _get_stripe():
    """Lazy-load stripe SDK and configure API key."""
    import stripe as _stripe
    _stripe.api_key = STRIPE_SECRET_KEY
    return _stripe


def _plan_from_price_id(price_id: str) -> str:
    if price_id == STRIPE_PREMIUM_PRICE_ID:
        return 'premium'
    if price_id == STRIPE_STARTER_PRICE_ID:
        return 'starter'
    return 'free'


@billing_bp.route('/create-checkout-session', methods=['POST'])
@tenant_required
def create_checkout_session():
    """
    Create a Stripe Checkout session for upgrading the active wedding's plan.
    Body: { "plan": "starter" | "premium" }
    """
    if not STRIPE_SECRET_KEY:
        return jsonify({'error': 'Stripe is not configured on this server'}), 503

    data = request.get_json() or {}
    plan = data.get('plan', 'starter')
    if plan not in ('starter', 'premium'):
        return jsonify({'error': 'plan must be "starter" or "premium"'}), 400

    price_id = STRIPE_STARTER_PRICE_ID if plan == 'starter' else STRIPE_PREMIUM_PRICE_ID
    if not price_id:
        return jsonify({'error': f'Price ID for {plan} plan is not configured'}), 503

    stripe = _get_stripe()
    wedding: Wedding = g.wedding

    # Create or reuse Stripe customer
    if not wedding.stripe_customer_id:
        customer = stripe.Customer.create(
            email=g.current_user.email,
            name=wedding.partner_one_name or g.current_user.name,
            metadata={'wedding_id': wedding.id, 'slug': wedding.slug},
        )
        wedding.stripe_customer_id = customer.id
        db.session.commit()

    try:
        session = stripe.checkout.Session.create(
            customer=wedding.stripe_customer_id,
            mode='subscription',
            line_items=[{'price': price_id, 'quantity': 1}],
            success_url=f"{FRONTEND_URL}/admin/billing?session_id={{CHECKOUT_SESSION_ID}}&status=success",
            cancel_url=f"{FRONTEND_URL}/admin/billing?status=cancelled",
            metadata={'wedding_id': wedding.id, 'plan': plan},
            subscription_data={'metadata': {'wedding_id': wedding.id}},
        )
    except Exception as e:
        logger.error(f"Stripe checkout error for wedding {wedding.id}: {e}")
        return jsonify({'error': 'Failed to create checkout session', 'detail': str(e)}), 500

    return jsonify({'checkout_url': session.url, 'session_id': session.id}), 200


@billing_bp.route('/webhook', methods=['POST'])
def stripe_webhook():
    """
    Handle Stripe webhook events to keep plan status in sync.
    Configured events: checkout.session.completed,
                       customer.subscription.updated,
                       customer.subscription.deleted
    """
    if not STRIPE_WEBHOOK_SECRET:
        return jsonify({'error': 'Webhook secret not configured'}), 503

    stripe = _get_stripe()
    payload = request.get_data(as_text=False)
    sig_header = request.headers.get('Stripe-Signature', '')

    try:
        event = stripe.Webhook.construct_event(payload, sig_header, STRIPE_WEBHOOK_SECRET)
    except stripe.error.SignatureVerificationError:
        logger.warning('Invalid Stripe webhook signature')
        return jsonify({'error': 'Invalid signature'}), 400
    except Exception as e:
        logger.error(f'Webhook parse error: {e}')
        return jsonify({'error': str(e)}), 400

    event_type = event['type']
    obj = event['data']['object']

    if event_type == 'checkout.session.completed':
        _handle_checkout_completed(obj)
    elif event_type in ('customer.subscription.updated', 'customer.subscription.created'):
        _handle_subscription_updated(obj)
    elif event_type == 'customer.subscription.deleted':
        _handle_subscription_deleted(obj)
    else:
        logger.debug(f'Unhandled Stripe event: {event_type}')

    return jsonify({'received': True}), 200


def _handle_checkout_completed(session):
    """Sync plan after successful checkout."""
    wedding_id = session.get('metadata', {}).get('wedding_id')
    if not wedding_id:
        return

    wedding = Wedding.query.get(wedding_id)
    if not wedding:
        return

    plan = session.get('metadata', {}).get('plan', 'starter')
    subscription_id = session.get('subscription')

    wedding.plan = plan
    if subscription_id:
        wedding.stripe_subscription_id = subscription_id
    wedding.is_active = True
    db.session.commit()
    logger.info(f'Wedding {wedding_id} upgraded to {plan}')


def _handle_subscription_updated(subscription):
    """Sync plan when subscription changes."""
    wedding_id = subscription.get('metadata', {}).get('wedding_id')
    if not wedding_id:
        # Fall back: look up by stripe_subscription_id
        wedding = Wedding.query.filter_by(stripe_subscription_id=subscription['id']).first()
    else:
        wedding = Wedding.query.get(wedding_id)

    if not wedding:
        return

    status = subscription.get('status')
    items = subscription.get('items', {}).get('data', [])
    price_id = items[0]['price']['id'] if items else None
    new_plan = _plan_from_price_id(price_id) if price_id else wedding.plan

    wedding.stripe_subscription_id = subscription['id']
    wedding.plan = new_plan
    wedding.is_active = status in ('active', 'trialing')
    db.session.commit()
    logger.info(f'Wedding {wedding.id} subscription updated: {new_plan} / {status}')


def _handle_subscription_deleted(subscription):
    """Downgrade to free when subscription is cancelled."""
    wedding = Wedding.query.filter_by(stripe_subscription_id=subscription['id']).first()
    if not wedding:
        return

    wedding.plan = 'free'
    wedding.stripe_subscription_id = None
    wedding.is_active = True
    db.session.commit()
    logger.info(f'Wedding {wedding.id} downgraded to free after subscription deletion')


@billing_bp.route('/portal', methods=['GET'])
@tenant_required
def billing_portal():
    """Return a Stripe Customer Portal URL for self-service plan management."""
    if not STRIPE_SECRET_KEY:
        return jsonify({'error': 'Stripe is not configured'}), 503

    stripe = _get_stripe()
    wedding: Wedding = g.wedding

    if not wedding.stripe_customer_id:
        return jsonify({'error': 'No Stripe customer found. Please subscribe to a plan first.'}), 404

    try:
        portal = stripe.billing_portal.Session.create(
            customer=wedding.stripe_customer_id,
            return_url=f"{FRONTEND_URL}/admin/billing",
        )
    except Exception as e:
        logger.error(f'Stripe portal error for wedding {wedding.id}: {e}')
        return jsonify({'error': 'Failed to create portal session', 'detail': str(e)}), 500

    return jsonify({'portal_url': portal.url}), 200


@billing_bp.route('/status', methods=['GET'])
@tenant_required
def billing_status():
    """Return current billing status for the active wedding."""
    wedding: Wedding = g.wedding
    return jsonify({
        'plan': wedding.plan,
        'is_active': wedding.is_active,
        'stripe_customer_id': wedding.stripe_customer_id,
        'stripe_subscription_id': wedding.stripe_subscription_id,
        'limits': Wedding.PLAN_LIMITS.get(wedding.plan, {}),
    }), 200
