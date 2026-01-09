from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
from src.models import db, Event, User
from src.utils.jwt_helpers import get_admin_id
from datetime import datetime
from sqlalchemy.exc import IntegrityError

events_bp = Blueprint('events', __name__)

@events_bp.route('', methods=['GET'])
def get_events():
    """Get all events (public events for guests, all for admins)"""
    # Check if user is authenticated (admin)
    auth_header = request.headers.get('Authorization')
    is_admin = False
    
    if auth_header and auth_header.startswith('Bearer '):
        try:
            from flask_jwt_extended import decode_token
            token = auth_header.split(' ')[1]
            decoded = decode_token(token)
            identity = decoded.get('sub')
            
            # Check if it's an admin token (not guest)
            if identity:
                identity_str = str(identity)
                if not identity_str.startswith('guest_'):
                    # Try to get admin ID
                    try:
                        admin_id = int(identity_str) if isinstance(identity_str, str) else identity
                        user = User.query.get(admin_id)
                        is_admin = user and user.role == 'admin'
                    except (ValueError, TypeError):
                        pass
        except:
            pass
    
    if is_admin:
        # Admins see all events
        events = Event.query.filter_by(is_active=True).order_by(Event.order, Event.start_time).all()
    else:
        # Guests see only public, active events (always filter by is_public=True)
        events = Event.query.filter_by(is_public=True, is_active=True).order_by(Event.order, Event.start_time).all()
    
    return jsonify([event.to_dict() for event in events]), 200

@events_bp.route('', methods=['POST'])
@jwt_required()
def create_event():
    """Create a new event (admin only)"""
    user_id = get_jwt_identity()
    user = User.query.get(user_id)
    
    if not user or user.role != 'admin':
        return jsonify({'error': 'Unauthorized'}), 403
    
    data = request.get_json()
    
    if not data or not data.get('name') or not data.get('start_time'):
        return jsonify({'error': 'Name and start_time are required'}), 400
    
    # Parse datetime
    try:
        start_time = datetime.fromisoformat(data['start_time'].replace('Z', '+00:00'))
        end_time = None
        if data.get('end_time'):
            end_time = datetime.fromisoformat(data['end_time'].replace('Z', '+00:00'))
        
        # Parse end_date if provided
        end_date = None
        if data.get('end_date'):
            from datetime import date
            end_date = date.fromisoformat(data['end_date'])
    except ValueError as e:
        return jsonify({'error': f'Invalid date format: {str(e)}'}), 400
    
    event = Event(
        user_id=user_id,
        name=data['name'],
        description=data.get('description', ''),
        location=data.get('location', ''),
        start_time=start_time,
        end_time=end_time,
        end_date=end_date,
        order=data.get('order', 0),
        is_public=data.get('is_public', True),
        is_active=data.get('is_active', True),
        dress_code=data.get('dress_code', ''),
        notes=data.get('notes', '')
    )
    
    try:
        db.session.add(event)
        db.session.commit()
        return jsonify(event.to_dict()), 201
    except IntegrityError:
        db.session.rollback()
        return jsonify({'error': 'Failed to create event'}), 500

@events_bp.route('/<int:event_id>', methods=['PUT'])
@jwt_required()
def update_event(event_id):
    """Update an event (admin only)"""
    user_id = get_jwt_identity()
    user = User.query.get(user_id)
    
    if not user or user.role != 'admin':
        return jsonify({'error': 'Unauthorized'}), 403
    
    event = Event.query.get_or_404(event_id)
    data = request.get_json()
    
    # Update fields
    if 'name' in data:
        event.name = data['name']
    if 'description' in data:
        event.description = data['description']
    if 'location' in data:
        event.location = data['location']
    if 'start_time' in data:
        try:
            event.start_time = datetime.fromisoformat(data['start_time'].replace('Z', '+00:00'))
        except ValueError:
            return jsonify({'error': 'Invalid start_time format'}), 400
    if 'end_time' in data:
        if data['end_time']:
            try:
                event.end_time = datetime.fromisoformat(data['end_time'].replace('Z', '+00:00'))
            except ValueError:
                return jsonify({'error': 'Invalid end_time format'}), 400
        else:
            event.end_time = None
    if 'end_date' in data:
        if data['end_date']:
            try:
                from datetime import date
                event.end_date = date.fromisoformat(data['end_date'])
            except ValueError:
                return jsonify({'error': 'Invalid end_date format'}), 400
        else:
            event.end_date = None
    if 'order' in data:
        event.order = data['order']
    if 'is_public' in data:
        event.is_public = data['is_public']
    if 'is_active' in data:
        event.is_active = data['is_active']
    if 'dress_code' in data:
        event.dress_code = data['dress_code']
    if 'notes' in data:
        event.notes = data['notes']
    
    try:
        db.session.commit()
        return jsonify(event.to_dict()), 200
    except IntegrityError:
        db.session.rollback()
        return jsonify({'error': 'Failed to update event'}), 500

@events_bp.route('/<int:event_id>', methods=['DELETE'])
@jwt_required()
def delete_event(event_id):
    """Delete an event (admin only)"""
    user_id = get_jwt_identity()
    user = User.query.get(user_id)
    
    if not user or user.role != 'admin':
        return jsonify({'error': 'Unauthorized'}), 403
    
    event = Event.query.get_or_404(event_id)
    
    try:
        db.session.delete(event)
        db.session.commit()
        return jsonify({'message': 'Event deleted successfully'}), 200
    except IntegrityError:
        db.session.rollback()
        return jsonify({'error': 'Failed to delete event'}), 500

