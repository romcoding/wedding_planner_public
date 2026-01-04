from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
from src.models import db, Guest, User
from datetime import datetime

guests_bp = Blueprint('guests', __name__)

@guests_bp.route('/update-rsvp', methods=['PUT'])
@jwt_required()
def update_rsvp():
    """Update RSVP information (guest authenticated via token)"""
    identity = get_jwt_identity()
    
    if not identity:
        return jsonify({'error': 'Unauthorized - No token provided'}), 403
    
    identity_str = str(identity)
    if not identity_str.startswith('guest_'):
        return jsonify({'error': 'Unauthorized - Guest token required'}), 403
    
    try:
        guest_id = int(identity_str.split('_')[1])
    except (ValueError, IndexError):
        return jsonify({'error': 'Invalid token format'}), 403
    
    guest = Guest.query.get(guest_id)
    
    if not guest:
        return jsonify({'error': 'Guest not found'}), 404
    
    data = request.get_json()
    
    # Update RSVP fields
    if 'rsvp_status' in data:
        guest.rsvp_status = data['rsvp_status']
    if 'overnight_stay' in data:
        guest.overnight_stay = bool(data['overnight_stay'])
    if 'number_of_guests' in data:
        guest.number_of_guests = data['number_of_guests']
    if 'dietary_restrictions' in data:
        guest.dietary_restrictions = data['dietary_restrictions']
    if 'allergies' in data:
        guest.allergies = data['allergies']
    if 'special_requests' in data:
        guest.special_requests = data['special_requests']
    if 'music_wish' in data:
        guest.music_wish = data['music_wish']
    if 'phone' in data:
        guest.phone = data['phone']
    if 'address' in data:
        guest.address = data['address']
    
    guest.updated_at = datetime.utcnow()
    guest.last_accessed = datetime.utcnow()
    db.session.commit()
    
    return jsonify({
        'message': 'RSVP updated successfully',
        'guest': guest.to_dict(include_sensitive=False)
    }), 200

@guests_bp.route('', methods=['POST'])
@jwt_required()
def create_guest():
    """Create a new guest (admin only) - generates unique token"""
    user_id = get_jwt_identity()
    # Convert to int if it's a string
    user_id = int(user_id) if isinstance(user_id, str) and not str(user_id).startswith('guest_') else user_id
    user = User.query.get(user_id)
    
    if not user or user.role != 'admin':
        return jsonify({'error': 'Unauthorized'}), 403
    
    data = request.get_json()
    
    if not data or not data.get('email') or not data.get('first_name') or not data.get('last_name'):
        return jsonify({'error': 'Email, first name, and last name are required'}), 400
    
    # Check if guest already exists
    existing_guest = Guest.query.filter_by(email=data['email']).first()
    if existing_guest:
        return jsonify({'error': 'Guest with this email already exists'}), 400
    
    # Generate unique token
    unique_token = Guest.generate_unique_token()
    # Ensure uniqueness
    while Guest.query.filter_by(unique_token=unique_token).first():
        unique_token = Guest.generate_unique_token()
    
    # Create guest with all admin-provided info
    guest = Guest(
        email=data['email'],
        first_name=data['first_name'],
        last_name=data['last_name'],
        phone=data.get('phone'),
        unique_token=unique_token,
        rsvp_status=data.get('rsvp_status', 'pending'),
        overnight_stay=data.get('overnight_stay', False),
        number_of_guests=data.get('number_of_guests', 1),
        dietary_restrictions=data.get('dietary_restrictions'),
        allergies=data.get('allergies'),
        special_requests=data.get('special_requests'),
        music_wish=data.get('music_wish'),
        address=data.get('address'),
        notes=data.get('notes'),
        language=data.get('language', 'en')
    )
    
    db.session.add(guest)
    db.session.commit()
    
    # Refresh to get the guest with all fields
    db.session.refresh(guest)
    
    # Get frontend URL for the unique link
    import os
    frontend_url = os.getenv('FRONTEND_URL', 'http://localhost:5173')
    rsvp_link = f"{frontend_url}/rsvp/{guest.unique_token}"
    
    # Build guest dict with rsvp_link included
    guest_dict = guest.to_dict(include_sensitive=True)
    guest_dict['rsvp_link'] = rsvp_link
    
    return jsonify({
        'message': 'Guest created successfully',
        'guest': guest_dict,
        'rsvp_link': rsvp_link
    }), 201

@guests_bp.route('', methods=['GET'])
@jwt_required()
def get_guests():
    """Get all guests (admin only)"""
    user_id = get_jwt_identity()
    # Convert to int if it's a string
    user_id = int(user_id) if isinstance(user_id, str) and not str(user_id).startswith('guest_') else user_id
    user = User.query.get(user_id)
    
    if not user:
        return jsonify({'error': 'User not found'}), 404
    
    # Filtering options
    rsvp_status = request.args.get('rsvp_status')
    overnight_stay = request.args.get('overnight_stay')
    
    query = Guest.query
    
    if rsvp_status:
        query = query.filter_by(rsvp_status=rsvp_status)
    if overnight_stay is not None:
        query = query.filter_by(overnight_stay=overnight_stay.lower() == 'true')
    
    guests = query.order_by(Guest.registered_at.desc()).all()
    
    # Include RSVP links for admin
    import os
    frontend_url = os.getenv('FRONTEND_URL', 'http://localhost:5173')
    guests_data = []
    for guest in guests:
        guest_dict = guest.to_dict(include_sensitive=True)
        # Generate token if missing (for backward compatibility)
        if not guest.unique_token:
            guest.unique_token = Guest.generate_unique_token()
            # Ensure uniqueness
            while Guest.query.filter_by(unique_token=guest.unique_token).filter(Guest.id != guest.id).first():
                guest.unique_token = Guest.generate_unique_token()
            db.session.commit()
        guest_dict['rsvp_link'] = f"{frontend_url}/rsvp/{guest.unique_token}" if guest.unique_token else None
        guests_data.append(guest_dict)
    
    return jsonify(guests_data), 200

@guests_bp.route('/token/<token>', methods=['GET'])
def get_guest_by_token(token):
    """Get guest by unique token (public endpoint for RSVP link)"""
    guest = Guest.query.filter_by(unique_token=token).first()
    
    if not guest:
        return jsonify({'error': 'Invalid RSVP link'}), 404
    
    # Update last accessed
    guest.last_accessed = datetime.utcnow()
    db.session.commit()
    
    return jsonify(guest.to_dict(include_sensitive=False)), 200

@guests_bp.route('/token/<token>/auth', methods=['POST'])
def authenticate_with_token(token):
    """Authenticate guest using unique token and return JWT (public endpoint)"""
    guest = Guest.query.filter_by(unique_token=token).first()
    
    if not guest:
        return jsonify({'error': 'Invalid RSVP link'}), 404
    
    # Update last accessed
    guest.last_accessed = datetime.utcnow()
    db.session.commit()
    
    # Generate JWT token
    from flask_jwt_extended import create_access_token
    access_token = create_access_token(identity=f"guest_{guest.id}")
    
    return jsonify({
        'access_token': access_token,
        'guest': guest.to_dict(include_sensitive=False)
    }), 200

@guests_bp.route('/<int:guest_id>', methods=['GET'])
@jwt_required()
def get_guest(guest_id):
    """Get specific guest details (admin only)"""
    user_id = get_jwt_identity()
    # Convert to int if it's a string
    user_id = int(user_id) if isinstance(user_id, str) and not str(user_id).startswith('guest_') else user_id
    user = User.query.get(user_id)
    
    if not user:
        return jsonify({'error': 'User not found'}), 404
    
    guest = Guest.query.get(guest_id)
    
    if not guest:
        return jsonify({'error': 'Guest not found'}), 404
    
    # Include RSVP link
    import os
    frontend_url = os.getenv('FRONTEND_URL', 'http://localhost:5173')
    guest_dict = guest.to_dict(include_sensitive=True)
    # Generate token if missing
    if not guest.unique_token:
        guest.unique_token = Guest.generate_unique_token()
        # Ensure uniqueness
        while Guest.query.filter_by(unique_token=guest.unique_token).filter(Guest.id != guest.id).first():
            guest.unique_token = Guest.generate_unique_token()
        db.session.commit()
    guest_dict['rsvp_link'] = f"{frontend_url}/rsvp/{guest.unique_token}" if guest.unique_token else None
    
    return jsonify(guest_dict), 200

@guests_bp.route('/<int:guest_id>', methods=['PUT'])
@jwt_required()
def update_guest(guest_id):
    """Update guest information (admin only)"""
    user_id = get_jwt_identity()
    # Convert to int if it's a string
    user_id = int(user_id) if isinstance(user_id, str) and not str(user_id).startswith('guest_') else user_id
    user = User.query.get(user_id)
    
    if not user:
        return jsonify({'error': 'User not found'}), 404
    
    guest = Guest.query.get(guest_id)
    
    if not guest:
        return jsonify({'error': 'Guest not found'}), 404
    
    data = request.get_json()
    
    # Update fields
    if 'first_name' in data:
        guest.first_name = data['first_name']
    if 'last_name' in data:
        guest.last_name = data['last_name']
    if 'email' in data:
        guest.email = data['email']
    if 'phone' in data:
        guest.phone = data['phone']
    if 'rsvp_status' in data:
        guest.rsvp_status = data['rsvp_status']
    if 'overnight_stay' in data:
        guest.overnight_stay = bool(data['overnight_stay'])
    if 'number_of_guests' in data:
        guest.number_of_guests = data['number_of_guests']
    if 'dietary_restrictions' in data:
        guest.dietary_restrictions = data['dietary_restrictions']
    if 'allergies' in data:
        guest.allergies = data['allergies']
    if 'special_requests' in data:
        guest.special_requests = data['special_requests']
    if 'music_wish' in data:
        guest.music_wish = data['music_wish']
    if 'address' in data:
        guest.address = data['address']
    if 'notes' in data:
        guest.notes = data['notes']
    
    guest.updated_at = datetime.utcnow()
    db.session.commit()
    
    return jsonify(guest.to_dict()), 200

@guests_bp.route('/<int:guest_id>', methods=['DELETE'])
@jwt_required()
def delete_guest(guest_id):
    """Delete guest (admin only)"""
    user_id = get_jwt_identity()
    # Convert to int if it's a string
    user_id = int(user_id) if isinstance(user_id, str) and not str(user_id).startswith('guest_') else user_id
    user = User.query.get(user_id)
    
    if not user:
        return jsonify({'error': 'User not found'}), 404
    
    guest = Guest.query.get(guest_id)
    
    if not guest:
        return jsonify({'error': 'Guest not found'}), 404
    
    db.session.delete(guest)
    db.session.commit()
    
    return jsonify({'message': 'Guest deleted successfully'}), 200

