from flask import Blueprint, request, jsonify
from flask_jwt_extended import create_access_token, jwt_required, get_jwt_identity
from src.models import db, User
from datetime import datetime, timedelta
from collections import defaultdict
from threading import Lock

auth_bp = Blueprint('auth', __name__)

# In-memory rate limit for admin auth: max 10 per 15 minutes per IP
_ADMIN_RATE_STORE = defaultdict(list)
_ADMIN_RATE_LOCK = Lock()
_ADMIN_RATE_MAX = 10
_ADMIN_RATE_WINDOW = 900  # 15 minutes


def _check_admin_rate_limit(ip):
    now = datetime.utcnow()
    with _ADMIN_RATE_LOCK:
        timestamps = _ADMIN_RATE_STORE[ip]
        cutoff = now - timedelta(seconds=_ADMIN_RATE_WINDOW)
        timestamps[:] = [t for t in timestamps if t > cutoff]
        if len(timestamps) >= _ADMIN_RATE_MAX:
            return False
        timestamps.append(now)
    return True


@auth_bp.route('/register', methods=['POST'])
def register():
    """Register a new admin user"""
    # Rate limit by IP
    if not _check_admin_rate_limit(request.remote_addr or 'unknown'):
        return jsonify({'error': 'Too many attempts. Please try again later.'}), 429

    data = request.get_json()
    
    if not data or not data.get('email') or not data.get('password'):
        return jsonify({'error': 'Email and password are required'}), 400
    
    if User.query.filter_by(email=data['email']).first():
        return jsonify({'error': 'User already exists'}), 400
    
    user = User(
        email=data['email'],
        name=data.get('name', data['email'].split('@')[0]),
        role=data.get('role', 'admin')
    )
    user.set_password(data['password'])
    
    db.session.add(user)
    db.session.commit()
    
    return jsonify({
        'message': 'User created successfully',
        'user': user.to_dict()
    }), 201

@auth_bp.route('/login', methods=['POST'])
def login():
    """Login and get JWT token"""
    # Rate limit by IP
    if not _check_admin_rate_limit(request.remote_addr or 'unknown'):
        return jsonify({'error': 'Too many login attempts. Please try again later.'}), 429

    data = request.get_json()
    
    if not data or not data.get('email') or not data.get('password'):
        return jsonify({'error': 'Email and password are required'}), 400
    
    user = User.query.filter_by(email=data['email']).first()
    
    if not user or not user.check_password(data['password']):
        # Track failed login attempt
        from src.utils.analytics_tracker import track_security_event
        track_security_event(
            event_type='failed_login',
            user_id=user.id if user else None,
            details={'email': data.get('email'), 'reason': 'invalid_credentials'},
            severity='medium'
        )
        return jsonify({'error': 'Invalid credentials'}), 401
    
    # Track successful login
    from src.utils.analytics_tracker import track_security_event
    track_security_event(
        event_type='successful_login',
        user_id=user.id,
        details={'email': user.email},
        severity='low'
    )
    
    # JWT identity must be a string
    access_token = create_access_token(identity=str(user.id))
    
    return jsonify({
        'access_token': access_token,
        'user': user.to_dict()
    }), 200

@auth_bp.route('/profile', methods=['GET'])
@jwt_required()
def get_profile():
    """Get current user profile (admin users only)"""
    user_id = get_jwt_identity()
    
    # Check if this is a guest token (guest tokens have identity like 'guest_13')
    if isinstance(user_id, str) and user_id.startswith('guest_'):
        # Guest tokens should use /api/guest-auth/profile instead
        return jsonify({'error': 'Guest tokens should use /api/guest-auth/profile'}), 401
    
    # Convert to int if it's a string (JWT identity is now a string)
    try:
        user_id = int(user_id) if isinstance(user_id, str) else user_id
    except ValueError:
        return jsonify({'error': 'Invalid token identity'}), 401
    
    user = User.query.get(user_id)
    
    if not user:
        return jsonify({'error': 'User not found'}), 404
    
    return jsonify(user.to_dict()), 200

@auth_bp.route('/profile', methods=['PUT'])
@jwt_required()
def update_profile():
    """Update current user profile (admin users only)"""
    user_id = get_jwt_identity()
    
    # Check if this is a guest token
    if isinstance(user_id, str) and user_id.startswith('guest_'):
        return jsonify({'error': 'Guest tokens cannot update admin profiles'}), 401
    
    # Convert to int if it's a string (JWT identity is now a string)
    try:
        user_id = int(user_id) if isinstance(user_id, str) else user_id
    except ValueError:
        return jsonify({'error': 'Invalid token identity'}), 401
    
    user = User.query.get(user_id)
    
    if not user:
        return jsonify({'error': 'User not found'}), 404
    
    data = request.get_json()
    
    if 'name' in data:
        user.name = data['name']
    if 'email' in data:
        if User.query.filter_by(email=data['email']).filter(User.id != user_id).first():
            return jsonify({'error': 'Email already in use'}), 400
        user.email = data['email']
    if 'password' in data and data['password']:
        user.set_password(data['password'])
    
    user.updated_at = datetime.utcnow()
    db.session.commit()
    
    return jsonify(user.to_dict()), 200

