"""
Tenant middleware utilities for multi-tenant SaaS support.

Usage:
    @tenant_required
    def my_route():
        wedding = g.wedding  # injected Wedding object

    @plan_required('starter')
    def premium_route():
        ...
"""
from functools import wraps
from flask import g, jsonify
from flask_jwt_extended import get_jwt_identity, verify_jwt_in_request


def _get_wedding_for_user(user_id: int):
    """Resolve the active Wedding for a given admin user ID."""
    from models import db
    from models.user import User
    from models.wedding import Wedding

    user = db.session.get(User, user_id)
    if not user:
        return None, 'User not found'

    # Use current_wedding_id if set, else fall back to first owned wedding
    if user.current_wedding_id:
        wedding = db.session.get(Wedding, user.current_wedding_id)
    else:
        wedding = Wedding.query.filter_by(owner_id=user_id, is_active=True).first()

    if not wedding:
        return None, 'No wedding found for this account. Please complete onboarding.'

    if not wedding.is_active:
        return None, 'This wedding account is inactive.'

    return wedding, None


def tenant_required(fn):
    """
    Decorator that:
    1. Verifies a valid JWT is present.
    2. Resolves the Wedding tenant for the authenticated user.
    3. Injects it as `g.wedding` and `g.current_user`.

    Routes that are already protected by @jwt_required() can also use this
    decorator instead — it handles JWT verification internally.
    """
    @wraps(fn)
    def wrapper(*args, **kwargs):
        try:
            verify_jwt_in_request()
        except Exception as e:
            return jsonify({'error': 'Authorization token required'}), 401

        identity = get_jwt_identity()

        # Reject guest tokens
        if isinstance(identity, str) and identity.startswith('guest_'):
            return jsonify({'error': 'Guest tokens cannot access tenant resources'}), 403

        try:
            user_id = int(identity)
        except (TypeError, ValueError):
            return jsonify({'error': 'Invalid token identity'}), 401

        wedding, err = _get_wedding_for_user(user_id)
        if err:
            return jsonify({'error': err, 'needs_onboarding': True}), 403

        from models.user import User
        g.wedding = wedding
        g.current_user = User.query.get(user_id)
        return fn(*args, **kwargs)

    return wrapper


def plan_required(min_plan: str):
    """
    Decorator factory that enforces a minimum plan level.
    Must be used on a route that is also protected by @tenant_required
    (or after tenant middleware has run and set g.wedding).

    Example:
        @plan_required('starter')
        def ai_feature():
            ...
    """
    def decorator(fn):
        @wraps(fn)
        def wrapper(*args, **kwargs):
            wedding = getattr(g, 'wedding', None)
            if wedding is None:
                return jsonify({'error': 'Tenant context not available'}), 500

            if not wedding.meets_plan(min_plan):
                return jsonify({
                    'error': f'This feature requires the {min_plan} plan or higher.',
                    'current_plan': wedding.plan,
                    'required_plan': min_plan,
                    'upgrade_url': '/admin/billing',
                }), 402

            return fn(*args, **kwargs)
        return wrapper
    return decorator
