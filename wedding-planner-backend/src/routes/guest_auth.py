from flask import Blueprint, request, jsonify
from flask_jwt_extended import create_access_token
from src.models import db, Guest
from datetime import datetime

guest_auth_bp = Blueprint('guest_auth', __name__)

@guest_auth_bp.route('/login', methods=['POST'])
def guest_login():
    """Guest login endpoint"""
    data = request.get_json()
    
    if not data or not data.get('username') or not data.get('password'):
        return jsonify({'error': 'Username and password are required'}), 400
    
    guest = Guest.query.filter_by(username=data['username']).first()
    
    if not guest or not guest.check_password(data['password']):
        return jsonify({'error': 'Invalid credentials'}), 401
    
    # Update last accessed
    guest.last_accessed = datetime.utcnow()
    db.session.commit()
    
    access_token = create_access_token(identity=f"guest_{guest.id}")
    
    return jsonify({
        'access_token': access_token,
        'guest': guest.to_dict(include_sensitive=False)
    }), 200

@guest_auth_bp.route('/register', methods=['POST'])
def guest_register():
    """Guest registration with authentication"""
    data = request.get_json()
    
    if not data or not data.get('email') or not data.get('first_name') or not data.get('last_name'):
        return jsonify({'error': 'Email, first name, and last name are required'}), 400
    
    if not data.get('username'):
        return jsonify({'error': 'Username is required'}), 400
    
    if not data.get('password'):
        return jsonify({'error': 'Password is required'}), 400
    
    # Check if username already exists
    if Guest.query.filter_by(username=data['username']).first():
        return jsonify({'error': 'Username already exists'}), 400
    
    # Check if email already exists
    existing_guest = Guest.query.filter_by(email=data['email']).first()
    
    if existing_guest:
        # Update existing guest with username/password
        existing_guest.username = data['username']
        existing_guest.set_password(data['password'])
        existing_guest.first_name = data.get('first_name', existing_guest.first_name)
        existing_guest.last_name = data.get('last_name', existing_guest.last_name)
        existing_guest.phone = data.get('phone', existing_guest.phone)
        existing_guest.updated_at = datetime.utcnow()
        existing_guest.last_accessed = datetime.utcnow()
        
        db.session.commit()
        
        access_token = create_access_token(identity=f"guest_{existing_guest.id}")
        return jsonify({
            'message': 'Guest account created',
            'access_token': access_token,
            'guest': existing_guest.to_dict(include_sensitive=False)
        }), 200
    
    # Create new guest
    guest = Guest(
        email=data['email'],
        first_name=data['first_name'],
        last_name=data['last_name'],
        phone=data.get('phone'),
        username=data['username'],
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
    guest.set_password(data['password'])
    
    db.session.add(guest)
    db.session.commit()
    
    access_token = create_access_token(identity=f"guest_{guest.id}")
    
    return jsonify({
        'message': 'Guest registered successfully',
        'access_token': access_token,
        'guest': guest.to_dict(include_sensitive=False)
    }), 201

