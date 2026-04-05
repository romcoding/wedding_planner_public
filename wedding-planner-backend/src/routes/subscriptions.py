from flask import Blueprint, jsonify, request
from flask_jwt_extended import jwt_required

from src.models import db, TokenUsage
from src.utils.rbac import require_roles
from src.utils.token_billing import ensure_subscription_for_user

subscriptions_bp = Blueprint('subscriptions', __name__)

PLANS = [
    {'plan_type': 'free', 'label': 'Free', 'monthly_tokens': 100, 'unlimited': False},
    {'plan_type': 'standard', 'label': 'Standard', 'monthly_tokens': 2000, 'unlimited': False},
    {'plan_type': 'premium', 'label': 'Premium', 'monthly_tokens': None, 'unlimited': True},
]


@subscriptions_bp.route('', methods=['GET'])
@jwt_required()
def get_subscription_overview():
    user, err = require_roles(['admin', 'planner', 'super_admin'])
    if err:
        return err

    subscription = ensure_subscription_for_user(user.id)
    usage = TokenUsage.query.filter_by(user_id=user.id).order_by(TokenUsage.created_at.desc()).limit(100).all()
    db.session.commit()

    return jsonify({
        'subscription': subscription.to_dict(),
        'plans': PLANS,
        'usage_history': [u.to_dict() for u in usage],
    }), 200


@subscriptions_bp.route('/upgrade', methods=['POST'])
@jwt_required()
def upgrade_subscription():
    user, err = require_roles(['admin', 'planner', 'super_admin'])
    if err:
        return err

    data = request.get_json() or {}
    requested = str(data.get('plan_type') or '').strip().lower()
    if requested not in {'free', 'standard', 'premium'}:
        return jsonify({'error': 'Invalid plan_type'}), 400

    subscription = ensure_subscription_for_user(user.id)
    subscription.plan_type = requested

    if requested == 'free':
        subscription.balance_tokens = max(subscription.balance_tokens, 100)
    elif requested == 'standard':
        subscription.balance_tokens = max(subscription.balance_tokens, 2000)

    db.session.commit()
    return jsonify({'ok': True, 'subscription': subscription.to_dict()}), 200


@subscriptions_bp.route('/top-up', methods=['POST'])
@jwt_required()
def top_up_tokens():
    user, err = require_roles(['admin', 'planner', 'super_admin'])
    if err:
        return err

    data = request.get_json() or {}
    tokens = int(data.get('tokens') or 0)
    if tokens <= 0:
        return jsonify({'error': 'tokens must be greater than zero'}), 400

    subscription = ensure_subscription_for_user(user.id)
    subscription.balance_tokens = int(subscription.balance_tokens or 0) + tokens
    db.session.commit()

    return jsonify({'ok': True, 'subscription': subscription.to_dict()}), 200
