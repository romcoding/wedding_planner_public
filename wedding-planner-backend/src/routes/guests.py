from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
from src.models import db, Guest, User
from datetime import datetime

guests_bp = Blueprint('guests', __name__)

@guests_bp.route('/register', methods=['POST'])
def register_guest():
    """Public endpoint for guest registration"""
    data = request.get_json()
    
    if not data or not data.get('email') or not data.get('first_name') or not data.get('last_name'):
        return jsonify({'error': 'Email, first name, and last name are required'}), 400
    
    # Check if guest already exists
    existing_guest = Guest.query.filter_by(email=data['email']).first()
    
    if existing_guest:
        # Update existing guest
        existing_guest.first_name = data.get('first_name', existing_guest.first_name)
        existing_guest.last_name = data.get('last_name', existing_guest.last_name)
        existing_guest.phone = data.get('phone', existing_guest.phone)
        existing_guest.rsvp_status = data.get('rsvp_status', existing_guest.rsvp_status)
        existing_guest.attendance_type = data.get('attendance_type', existing_guest.attendance_type)
        existing_guest.number_of_guests = data.get('number_of_guests', existing_guest.number_of_guests)
        existing_guest.dietary_restrictions = data.get('dietary_restrictions', existing_guest.dietary_restrictions)
        existing_guest.allergies = data.get('allergies', existing_guest.allergies)
        existing_guest.special_requests = data.get('special_requests', existing_guest.special_requests)
        existing_guest.music_wish = data.get('music_wish', existing_guest.music_wish)
        existing_guest.address = data.get('address', existing_guest.address)
        existing_guest.notes = data.get('notes', existing_guest.notes)
        existing_guest.updated_at = datetime.utcnow()
        existing_guest.last_accessed = datetime.utcnow()
        
        db.session.commit()
        return jsonify({
            'message': 'Guest information updated',
            'guest': existing_guest.to_dict()
        }), 200
    
    # Create new guest
    guest = Guest(
        email=data['email'],
        first_name=data['first_name'],
        last_name=data['last_name'],
        phone=data.get('phone'),
        rsvp_status=data.get('rsvp_status', 'pending'),
        attendance_type=data.get('attendance_type'),
        number_of_guests=data.get('number_of_guests', 1),
        dietary_restrictions=data.get('dietary_restrictions'),
        allergies=data.get('allergies'),
        special_requests=data.get('special_requests'),
        music_wish=data.get('music_wish'),
        address=data.get('address'),
        notes=data.get('notes')
    )
    
    db.session.add(guest)
    db.session.commit()
    
    return jsonify({
        'message': 'Guest registered successfully',
        'guest': guest.to_dict()
    }), 201

@guests_bp.route('', methods=['GET'])
@jwt_required()
def get_guests():
    """Get all guests (admin only)"""
    user_id = get_jwt_identity()
    user = User.query.get(user_id)
    
    if not user:
        return jsonify({'error': 'User not found'}), 404
    
    # Filtering options
    rsvp_status = request.args.get('rsvp_status')
    attendance_type = request.args.get('attendance_type')
    
    query = Guest.query
    
    if rsvp_status:
        query = query.filter_by(rsvp_status=rsvp_status)
    if attendance_type:
        query = query.filter_by(attendance_type=attendance_type)
    
    guests = query.order_by(Guest.registered_at.desc()).all()
    
    return jsonify([guest.to_dict() for guest in guests]), 200

@guests_bp.route('/<int:guest_id>', methods=['GET'])
@jwt_required()
def get_guest(guest_id):
    """Get specific guest details (admin only)"""
    user_id = get_jwt_identity()
    user = User.query.get(user_id)
    
    if not user:
        return jsonify({'error': 'User not found'}), 404
    
    guest = Guest.query.get(guest_id)
    
    if not guest:
        return jsonify({'error': 'Guest not found'}), 404
    
    return jsonify(guest.to_dict()), 200

@guests_bp.route('/<int:guest_id>', methods=['PUT'])
@jwt_required()
def update_guest(guest_id):
    """Update guest information (admin only)"""
    user_id = get_jwt_identity()
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
    if 'attendance_type' in data:
        guest.attendance_type = data['attendance_type']
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
    user = User.query.get(user_id)
    
    if not user:
        return jsonify({'error': 'User not found'}), 404
    
    guest = Guest.query.get(guest_id)
    
    if not guest:
        return jsonify({'error': 'Guest not found'}), 404
    
    db.session.delete(guest)
    db.session.commit()
    
    return jsonify({'message': 'Guest deleted successfully'}), 200

