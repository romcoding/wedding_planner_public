import os
from functools import wraps

from flask import jsonify, g, request

from src.models import db, UserSubscription, TokenUsage
from src.utils.rbac import get_current_user

FREE_PLAN_MONTHLY_TOKENS = int(os.getenv('FREE_PLAN_MONTHLY_TOKENS', '100'))
DEFAULT_BASE_TOKEN_PRICE = float(os.getenv('OPENCLAW_BASE_PRICE_PER_TOKEN', '0.001'))


def _estimate_tokens_from_payload(payload):
    # Rough estimate: ~4 chars/token
    text = str(payload or '')
    return max(1, (len(text) + 3) // 4)


def ensure_subscription_for_user(user_id):
    subscription = UserSubscription.query.filter_by(user_id=user_id).first()
    if subscription:
        return subscription

    subscription = UserSubscription(
        user_id=user_id,
        plan_type='free',
        balance_tokens=FREE_PLAN_MONTHLY_TOKENS,
        is_active=True,
    )
    db.session.add(subscription)
    db.session.flush()
    return subscription


def requires_tokens(feature_name):
    """Pre-check available token balance and attach billing context."""
    def decorator(fn):
        @wraps(fn)
        def wrapped(*args, **kwargs):
            user = get_current_user()
            if not user:
                return jsonify({'error': 'Unauthorized'}), 403

            subscription = ensure_subscription_for_user(user.id)
            payload = request.get_json(silent=True) or {}
            estimated_tokens = _estimate_tokens_from_payload(payload)

            # Premium: unlimited
            if subscription.plan_type != 'premium' and subscription.balance_tokens < estimated_tokens:
                return jsonify({
                    'error': 'Insufficient token balance. Please top up to continue using AI features.',
                    'required_tokens': estimated_tokens,
                    'balance_tokens': subscription.balance_tokens,
                    'feature': feature_name,
                }), 402

            g.token_billing = {
                'feature_name': feature_name,
                'estimated_tokens': estimated_tokens,
                'user_id': user.id,
            }
            return fn(*args, **kwargs)
        return wrapped
    return decorator


def charge_tokens(feature_name, prompt_payload, completion_payload, explicit_tokens=None):
    user = get_current_user()
    if not user:
        return None

    subscription = ensure_subscription_for_user(user.id)

    if explicit_tokens is None:
        prompt_tokens = _estimate_tokens_from_payload(prompt_payload)
        completion_tokens = _estimate_tokens_from_payload(completion_payload)
        tokens = prompt_tokens + completion_tokens
    else:
        tokens = max(1, int(explicit_tokens))

    base_price = DEFAULT_BASE_TOKEN_PRICE
    cost_base = tokens * base_price
    cost_margin = cost_base * 0.4

    if subscription.plan_type != 'premium':
        subscription.balance_tokens = max(0, int(subscription.balance_tokens or 0) - tokens)

    usage = TokenUsage(
        user_id=user.id,
        feature=feature_name,
        tokens_consumed=tokens,
        cost_base=cost_base,
        cost_margin=cost_margin,
    )
    db.session.add(usage)
    db.session.commit()

    return usage
