"""
Role-Based Access Control (RBAC) permissions system
"""
from functools import wraps
from flask import jsonify
from flask_jwt_extended import get_jwt_identity
from src.models import User

# Define roles hierarchy (higher number = more permissions)
ROLES = {
    'guest': 0,
    'vendor': 1,
    'planner': 2,
    'admin': 3,
    'super_admin': 4
}

# Define permissions for each role
PERMISSIONS = {
    'guest': [
        'view_own_profile',
        'update_own_profile',
        'view_own_rsvp',
        'update_own_rsvp',
    ],
    'vendor': [
        'view_own_profile',
        'update_own_profile',
        'view_assigned_tasks',
        'update_assigned_tasks',
        'view_assigned_costs',
    ],
    'planner': [
        'view_own_profile',
        'update_own_profile',
        'view_guests',
        'view_tasks',
        'create_tasks',
        'update_tasks',
        'view_costs',
        'create_costs',
        'update_costs',
        'view_events',
        'create_events',
        'update_events',
        'view_invitations',
        'send_invitations',
        'view_analytics',
    ],
    'admin': [
        'view_own_profile',
        'update_own_profile',
        'view_guests',
        'create_guests',
        'update_guests',
        'delete_guests',
        'view_tasks',
        'create_tasks',
        'update_tasks',
        'delete_tasks',
        'view_costs',
        'create_costs',
        'update_costs',
        'delete_costs',
        'view_events',
        'create_events',
        'update_events',
        'delete_events',
        'view_invitations',
        'create_invitations',
        'send_invitations',
        'update_invitations',
        'view_venues',
        'create_venues',
        'update_venues',
        'delete_venues',
        'view_content',
        'create_content',
        'update_content',
        'delete_content',
        'view_analytics',
        'view_security_events',
        'manage_users',
    ],
    'super_admin': [
        # All permissions from admin plus:
        'manage_all_users',
        'delete_users',
        'view_all_security_events',
        'manage_system_settings',
    ]
}

def has_permission(user_role, permission):
    """Check if a role has a specific permission"""
    if user_role not in PERMISSIONS:
        return False
    
    # Super admin has all permissions
    if user_role == 'super_admin':
        return True
    
    # Check if permission is in role's permission list
    return permission in PERMISSIONS.get(user_role, [])

def has_role(user_role, required_role):
    """Check if user role meets minimum required role level"""
    user_level = ROLES.get(user_role, 0)
    required_level = ROLES.get(required_role, 0)
    return user_level >= required_level

def require_permission(permission):
    """Decorator to require a specific permission"""
    def decorator(f):
        @wraps(f)
        def decorated_function(*args, **kwargs):
            user_id = get_jwt_identity()
            if not user_id:
                return jsonify({'error': 'Unauthorized'}), 401
            
            # Convert to int if string
            user_id = int(user_id) if isinstance(user_id, str) else user_id
            user = User.query.get(user_id)
            
            if not user:
                return jsonify({'error': 'User not found'}), 404
            
            if not has_permission(user.role, permission):
                return jsonify({'error': f'Insufficient permissions. Required: {permission}'}), 403
            
            return f(*args, **kwargs)
        return decorated_function
    return decorator

def require_role(required_role):
    """Decorator to require a minimum role level"""
    def decorator(f):
        @wraps(f)
        def decorated_function(*args, **kwargs):
            user_id = get_jwt_identity()
            if not user_id:
                return jsonify({'error': 'Unauthorized'}), 401
            
            # Convert to int if string
            user_id = int(user_id) if isinstance(user_id, str) else user_id
            user = User.query.get(user_id)
            
            if not user:
                return jsonify({'error': 'User not found'}), 404
            
            if not has_role(user.role, required_role):
                return jsonify({'error': f'Insufficient role. Required: {required_role}'}), 403
            
            return f(*args, **kwargs)
        return decorated_function
    return decorator

def get_user_permissions(user_role):
    """Get all permissions for a role"""
    if user_role == 'super_admin':
        # Super admin has all permissions
        all_perms = set()
        for perms in PERMISSIONS.values():
            all_perms.update(perms)
        return list(all_perms)
    
    return PERMISSIONS.get(user_role, [])
