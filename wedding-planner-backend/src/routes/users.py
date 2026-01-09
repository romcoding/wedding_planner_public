"""
User management routes for RBAC
"""
from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
from src.models import db, User
from src.utils.permissions import require_permission, require_role, get_user_permissions
from src.utils.jwt_helpers import get_admin_id

users_bp = Blueprint('users', __name__)

@users_bp.route('', methods=['GET'])
@jwt_required()
@require_permission('manage_users')
def get_users():
    """Get all users (admin only)"""
    users = User.query.all()
    return jsonify([user.to_dict(include_permissions=True) for user in users]), 200

@users_bp.route('/<int:user_id>', methods=['GET'])
@jwt_required()
def get_user(user_id):
    """Get user by ID"""
    current_user_id = get_jwt_identity()
    current_user_id = int(current_user_id) if isinstance(current_user_id, str) else current_user_id
    current_user = User.query.get(current_user_id)
    
    # Users can view their own profile, admins can view any
    if current_user_id != user_id and not current_user:
        return jsonify({'error': 'Unauthorized'}), 403
    
    if current_user and current_user.role in ['admin', 'super_admin']:
        # Admin can view any user
        user = User.query.get_or_404(user_id)
        return jsonify(user.to_dict(include_permissions=True)), 200
    elif current_user_id == user_id:
        # User viewing own profile
        user = User.query.get_or_404(user_id)
        return jsonify(user.to_dict(include_permissions=True)), 200
    else:
        return jsonify({'error': 'Unauthorized'}), 403

@users_bp.route('', methods=['POST'])
@jwt_required()
@require_permission('manage_users')
def create_user():
    """Create a new user (admin only)"""
    data = request.get_json()
    
    if not data or not data.get('email') or not data.get('password'):
        return jsonify({'error': 'Email and password are required'}), 400
    
    if User.query.filter_by(email=data['email']).first():
        return jsonify({'error': 'User already exists'}), 400
    
    # Validate role
    valid_roles = ['guest', 'vendor', 'planner', 'admin', 'super_admin']
    role = data.get('role', 'admin')
    if role not in valid_roles:
        return jsonify({'error': f'Invalid role. Must be one of: {", ".join(valid_roles)}'}), 400
    
    user = User(
        email=data['email'],
        name=data.get('name', data['email'].split('@')[0]),
        role=role,
        is_active=data.get('is_active', True)
    )
    user.set_password(data['password'])
    
    db.session.add(user)
    db.session.commit()
    
    return jsonify(user.to_dict(include_permissions=True)), 201

@users_bp.route('/<int:user_id>', methods=['PUT'])
@jwt_required()
def update_user(user_id):
    """Update user (admin can update any, users can update own profile)"""
    current_user_id = get_jwt_identity()
    current_user_id = int(current_user_id) if isinstance(current_user_id, str) else current_user_id
    current_user = User.query.get(current_user_id)
    
    user = User.query.get_or_404(user_id)
    data = request.get_json()
    
    # Check permissions
    can_update = False
    if current_user_id == user_id:
        # Users can update their own profile (except role and is_active)
        can_update = True
    elif current_user and current_user.role in ['admin', 'super_admin']:
        # Admins can update any user
        can_update = True
    
    if not can_update:
        return jsonify({'error': 'Unauthorized'}), 403
    
    # Update fields
    if 'name' in data:
        user.name = data['name']
    if 'email' in data:
        if User.query.filter_by(email=data['email']).filter(User.id != user_id).first():
            return jsonify({'error': 'Email already in use'}), 400
        user.email = data['email']
    if 'password' in data and data['password']:
        user.set_password(data['password'])
    
    # Only admins can change role and is_active
    if current_user and current_user.role in ['admin', 'super_admin']:
        if 'role' in data:
            valid_roles = ['guest', 'vendor', 'planner', 'admin', 'super_admin']
            if data['role'] not in valid_roles:
                return jsonify({'error': f'Invalid role. Must be one of: {", ".join(valid_roles)}'}), 400
            # Prevent downgrading super_admin unless current user is super_admin
            if user.role == 'super_admin' and current_user.role != 'super_admin':
                return jsonify({'error': 'Cannot modify super_admin user'}), 403
            user.role = data['role']
        if 'is_active' in data:
            # Prevent deactivating super_admin unless current user is super_admin
            if user.role == 'super_admin' and current_user.role != 'super_admin':
                return jsonify({'error': 'Cannot deactivate super_admin user'}), 403
            user.is_active = data['is_active']
    
    db.session.commit()
    return jsonify(user.to_dict(include_permissions=True)), 200

@users_bp.route('/<int:user_id>', methods=['DELETE'])
@jwt_required()
@require_permission('manage_all_users')
def delete_user(user_id):
    """Delete a user (super_admin only)"""
    current_user_id = get_jwt_identity()
    current_user_id = int(current_user_id) if isinstance(current_user_id, str) else current_user_id
    current_user = User.query.get(current_user_id)
    
    user = User.query.get_or_404(user_id)
    
    # Prevent deleting yourself
    if current_user_id == user_id:
        return jsonify({'error': 'Cannot delete your own account'}), 400
    
    # Prevent deleting super_admin unless current user is super_admin
    if user.role == 'super_admin' and (not current_user or current_user.role != 'super_admin'):
        return jsonify({'error': 'Cannot delete super_admin user'}), 403
    
    db.session.delete(user)
    db.session.commit()
    
    return jsonify({'message': 'User deleted successfully'}), 200

@users_bp.route('/permissions', methods=['GET'])
@jwt_required()
def get_permissions():
    """Get current user's permissions"""
    user_id = get_jwt_identity()
    user_id = int(user_id) if isinstance(user_id, str) else user_id
    user = User.query.get(user_id)
    
    if not user:
        return jsonify({'error': 'User not found'}), 404
    
    return jsonify({
        'role': user.role,
        'permissions': get_user_permissions(user.role)
    }), 200
