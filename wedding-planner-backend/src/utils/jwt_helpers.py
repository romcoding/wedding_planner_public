"""
Helper functions for JWT token handling
"""
from flask_jwt_extended import get_jwt_identity

def get_admin_id():
    """Extracts and converts admin user ID from JWT identity."""
    identity = get_jwt_identity()
    if identity is None:
        return None
    
    # If it's already an int, return it
    if isinstance(identity, int):
        return identity
    
    # If it's a string
    if isinstance(identity, str):
        # Check if it's a guest token
        if identity.startswith('guest_'):
            return None  # This is a guest token, not an admin user
        
        # Try to convert to int
        try:
            return int(identity)
        except ValueError:
            return None
    
    return None

def get_guest_id():
    """Extracts and converts guest ID from JWT identity."""
    identity = get_jwt_identity()
    if identity is None:
        return None
    
    if isinstance(identity, str) and identity.startswith('guest_'):
        try:
            return int(identity.split('_')[1])
        except (ValueError, IndexError):
            return None
    
    return None

def get_user_id_from_jwt(identity):
    """
    Extract user ID from JWT identity.
    Handles both string and integer identities, and guest tokens.
    
    Args:
        identity: JWT identity (can be string or int)
    
    Returns:
        int: User ID, or None if it's a guest token
    """
    if identity is None:
        return None
    
    # If it's already an int, return it
    if isinstance(identity, int):
        return identity
    
    # If it's a string
    if isinstance(identity, str):
        # Check if it's a guest token
        if identity.startswith('guest_'):
            return None  # This is a guest token, not an admin user
        
        # Try to convert to int
        try:
            return int(identity)
        except ValueError:
            return None
    
    return None

