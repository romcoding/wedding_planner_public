from flask import Blueprint, jsonify, request, g
from flask_jwt_extended import jwt_required

from src.services.openclaw_service import OpenClawService
from src.utils.token_billing import ensure_subscription_for_user
from src.utils.rbac import require_roles
from src.utils.token_billing import requires_tokens, charge_tokens
from src.utils.tenant import tenant_required, plan_required

ai_bp = Blueprint('ai', __name__)


@ai_bp.route('/webpage-command', methods=['POST'])
@jwt_required()
@requires_tokens('webpage_command')
def webpage_command():
    """Process a natural-language webpage command in a restricted/safe scope."""
    user, err = require_roles(['admin', 'planner', 'super_admin'])
    if err:
        return err

    data = request.get_json() or {}
    message = data.get('message')
    current_config = data.get('current_config') or {}

    if not str(message or '').strip():
        return jsonify({'error': 'message is required'}), 400

    result = OpenClawService.apply_command(message=message, current_config=current_config)
    usage = charge_tokens('webpage_command', {'message': message, 'current_config': current_config}, result)
    subscription = ensure_subscription_for_user(user.id)
    return jsonify({
        'assistant_reply': result['assistant_reply'],
        'updated_config': result['updated_config'],
        'meta': {
            'provider': 'openclaw-safe-fallback',
            'mode': 'assistant-only',
            'user_id': user.id,
            'tokens_charged': usage.tokens_consumed if usage else 0,
            'tokens_remaining': subscription.balance_tokens if subscription else None,
        },
    }), 200


# ── Claude-powered AI Features (Pillar 3) ───────────────────────────────────

def _ai_gate(wedding):
    """
    Check plan and daily usage limit. Returns (allowed, response_if_blocked).
    premium plan → unlimited. starter → 3/day. free → blocked.
    """
    from src.services.ai_service import check_and_increment_usage
    if not wedding.meets_plan('starter'):
        return False, (jsonify({
            'error': 'AI features require the Starter plan or higher.',
            'current_plan': wedding.plan,
            'upgrade_url': '/admin/billing',
        }), 402)

    result = check_and_increment_usage(wedding)
    if not result['allowed']:
        return False, (jsonify({
            'error': 'Daily AI limit reached. Upgrade to Premium for unlimited AI.',
            'count': result['count'],
            'limit': result['limit'],
            'upgrade_url': '/admin/billing',
        }), 429)

    return True, None


@ai_bp.route('/usage', methods=['GET'])
@tenant_required
def get_ai_usage():
    """Return today's AI usage count and limit for the active wedding."""
    from src.models.ai_usage import AIUsage
    wedding = g.wedding
    count = AIUsage.get_today_count(wedding.id)
    limit = wedding.get_limit('ai_uses_per_day')
    return jsonify({
        'count': count,
        'limit': limit,
        'plan': wedding.plan,
        'unlimited': limit is None,
    }), 200


@ai_bp.route('/timeline', methods=['POST'])
@tenant_required
def ai_timeline():
    """
    AI Wedding Timeline Builder.
    Input: { wedding_date, location, guest_count, ceremony_type }
    Output: structured month-by-month timeline
    """
    allowed, blocked = _ai_gate(g.wedding)
    if not allowed:
        return blocked

    from src.services.ai_service import generate_timeline
    data = request.get_json() or {}

    required = ['wedding_date', 'location', 'guest_count', 'ceremony_type']
    missing = [f for f in required if not data.get(f)]
    if missing:
        return jsonify({'error': f'Missing fields: {", ".join(missing)}'}), 400

    try:
        result = generate_timeline(
            wedding_date=str(data['wedding_date']),
            location=str(data['location']),
            guest_count=int(data['guest_count']),
            ceremony_type=str(data['ceremony_type']),
        )
    except RuntimeError as e:
        return jsonify({'error': str(e)}), 502

    return jsonify(result), 200


@ai_bp.route('/vendor-suggestions', methods=['POST'])
@tenant_required
def ai_vendor_suggestions():
    """
    AI Vendor Suggestions.
    Input: { budget, location, style_preferences, guest_count }
    Output: vendor categories with tips and budget allocation
    """
    allowed, blocked = _ai_gate(g.wedding)
    if not allowed:
        return blocked

    from src.services.ai_service import generate_vendor_suggestions
    data = request.get_json() or {}

    required = ['budget', 'location', 'style_preferences', 'guest_count']
    missing = [f for f in required if not str(data.get(f, '')).strip()]
    if missing:
        return jsonify({'error': f'Missing fields: {", ".join(missing)}'}), 400

    try:
        result = generate_vendor_suggestions(
            budget=float(data['budget']),
            location=str(data['location']),
            style_preferences=str(data['style_preferences']),
            guest_count=int(data['guest_count']),
        )
    except RuntimeError as e:
        return jsonify({'error': str(e)}), 502

    return jsonify(result), 200


@ai_bp.route('/copy-generator', methods=['POST'])
@tenant_required
def ai_copy_generator():
    """
    Wedding Website Copy Generator.
    Input: { couple_names, wedding_date, location, story_notes }
    Output: welcome text, Our Story section, FAQ drafts
    """
    allowed, blocked = _ai_gate(g.wedding)
    if not allowed:
        return blocked

    from src.services.ai_service import generate_website_copy
    data = request.get_json() or {}

    required = ['couple_names', 'wedding_date', 'location', 'story_notes']
    missing = [f for f in required if not str(data.get(f, '')).strip()]
    if missing:
        return jsonify({'error': f'Missing fields: {", ".join(missing)}'}), 400

    try:
        result = generate_website_copy(
            couple_names=str(data['couple_names']),
            wedding_date=str(data['wedding_date']),
            location=str(data['location']),
            story_notes=str(data['story_notes']),
        )
    except RuntimeError as e:
        return jsonify({'error': str(e)}), 502

    return jsonify(result), 200


@ai_bp.route('/seating', methods=['POST'])
@tenant_required
def ai_seating():
    """
    Smart Seating Suggestions.
    Input: { guests: [{ name, dietary, relationship, notes }] }
    Output: suggested table groupings with reasoning
    """
    allowed, blocked = _ai_gate(g.wedding)
    if not allowed:
        return blocked

    from src.services.ai_service import generate_seating_suggestions
    data = request.get_json() or {}
    guests = data.get('guests', [])

    if not guests or not isinstance(guests, list):
        return jsonify({'error': 'guests array is required'}), 400
    if len(guests) > 500:
        return jsonify({'error': 'Too many guests. Maximum 500 per request.'}), 400

    try:
        result = generate_seating_suggestions(guests=guests)
    except RuntimeError as e:
        return jsonify({'error': str(e)}), 502

    return jsonify(result), 200
