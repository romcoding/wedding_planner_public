from flask import Blueprint, jsonify, request
from flask_jwt_extended import jwt_required

from src.services.openclaw_service import OpenClawService
from src.utils.rbac import require_roles

ai_bp = Blueprint('ai', __name__)


@ai_bp.route('/webpage-command', methods=['POST'])
@jwt_required()
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
    return jsonify({
        'assistant_reply': result['assistant_reply'],
        'updated_config': result['updated_config'],
        'meta': {
            'provider': 'openclaw-safe-fallback',
            'mode': 'assistant-only',
            'user_id': user.id,
        },
    }), 200
