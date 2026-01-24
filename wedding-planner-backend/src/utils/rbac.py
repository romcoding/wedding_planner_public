from flask import jsonify
from flask_jwt_extended import get_jwt_identity
from src.models import User
from src.utils.jwt_helpers import get_user_id_from_jwt


def get_current_user():
    """
    Returns the authenticated dashboard user (admin/planner/etc), or None for guests/anonymous.
    """
    identity = get_jwt_identity()
    user_id = get_user_id_from_jwt(identity)
    if not user_id:
        return None
    return User.query.get(user_id)


def require_roles(allowed_roles):
    """
    Role gate for dashboard routes.

    Returns: (user, error_response)
      - user: User instance when authorized
      - error_response: Flask response tuple when unauthorized, else None
    """
    user = get_current_user()
    if not user:
        return None, (jsonify({'error': 'Unauthorized'}), 403)
    if user.role not in set(allowed_roles or []):
        return None, (jsonify({'error': 'Unauthorized'}), 403)
    return user, None

