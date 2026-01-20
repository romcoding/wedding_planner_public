from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
from src.models import db, Message, User, Guest
from datetime import datetime
from sqlalchemy.exc import IntegrityError
import os
from src.services.email_service import EmailService

messages_bp = Blueprint('messages', __name__)

@messages_bp.route('', methods=['POST'])
def create_message():
    """Create a message (guest or admin)"""
    data = request.get_json()
    
    if not data or not data.get('subject') or not data.get('body'):
        return jsonify({'error': 'Subject and body are required'}), 400
    
    # Check if this is from a guest (has guest token) or admin
    auth_header = request.headers.get('Authorization')
    guest_id = None
    user_id = None
    sender_type = 'guest'
    
    if auth_header and auth_header.startswith('Bearer '):
        try:
            from flask_jwt_extended import decode_token
            token = auth_header.split(' ')[1]
            decoded = decode_token(token)
            identity = decoded.get('sub')
            
            if str(identity).startswith('guest_'):
                guest_id = int(identity.split('_')[1])
                sender_type = 'guest'
            else:
                user_id = identity
                user = User.query.get(user_id)
                if user and user.role == 'admin':
                    sender_type = 'admin'
        except:
            pass
    
    message = Message(
        guest_id=guest_id,
        user_id=user_id,
        subject=data['subject'],
        body=data['body'],
        sender_type=sender_type,
        status='unread'
    )
    
    try:
        db.session.add(message)
        db.session.commit()

        # Optional: forward guest messages to an email inbox (requires SMTP env vars configured).
        forward_to = os.getenv('CONTACT_FORWARD_EMAIL')
        if forward_to and sender_type == 'guest':
            guest = Guest.query.get(guest_id) if guest_id else None
            guest_name = f"{guest.first_name} {guest.last_name}".strip() if guest else "Anonymous"
            guest_email = guest.email if guest else None
            subject = f"[Wedding Planner] New guest message: {data['subject']}"
            body = (
                f"<p><strong>From:</strong> {guest_name} ({guest_email or 'no email'})</p>"
                f"<p><strong>Guest ID:</strong> {guest_id or '—'}</p>"
                f"<hr/>"
                f"<p>{(data.get('body') or '').replace('\\n', '<br/>')}</p>"
            )
            EmailService.send_notification_email(forward_to, subject, body)

        return jsonify({
            'message': 'Message sent successfully',
            'message_data': message.to_dict()
        }), 201
    except IntegrityError:
        db.session.rollback()
        return jsonify({'error': 'Failed to send message'}), 500

@messages_bp.route('', methods=['GET'])
@jwt_required()
def get_messages():
    """Get messages (admin sees all, guests see their own)"""
    identity = get_jwt_identity()
    
    # Check if admin or guest
    if str(identity).startswith('guest_'):
        # Guest sees only their messages
        guest_id = int(identity.split('_')[1])
        messages = Message.query.filter_by(guest_id=guest_id).order_by(Message.created_at.desc()).all()
    else:
        # Admin sees all messages
        user = User.query.get(identity)
        if not user or user.role != 'admin':
            return jsonify({'error': 'Unauthorized'}), 403
        messages = Message.query.order_by(Message.created_at.desc()).all()
    
    return jsonify([msg.to_dict() for msg in messages]), 200

@messages_bp.route('/<int:message_id>', methods=['GET'])
@jwt_required()
def get_message(message_id):
    """Get specific message"""
    identity = get_jwt_identity()
    message = Message.query.get_or_404(message_id)
    
    # Check permissions
    if str(identity).startswith('guest_'):
        guest_id = int(identity.split('_')[1])
        if message.guest_id != guest_id:
            return jsonify({'error': 'Unauthorized'}), 403
    else:
        user = User.query.get(identity)
        if not user or user.role != 'admin':
            return jsonify({'error': 'Unauthorized'}), 403
    
    # Mark as read if unread
    if message.status == 'unread':
        message.status = 'read'
        db.session.commit()
    
    return jsonify(message.to_dict()), 200

@messages_bp.route('/<int:message_id>', methods=['PUT'])
@jwt_required()
def update_message(message_id):
    """Update message status (admin only for now)"""
    identity = get_jwt_identity()
    
    if str(identity).startswith('guest_'):
        return jsonify({'error': 'Guests cannot update messages'}), 403
    
    user = User.query.get(identity)
    if not user or user.role != 'admin':
        return jsonify({'error': 'Unauthorized'}), 403
    
    message = Message.query.get_or_404(message_id)
    data = request.get_json()
    
    if 'status' in data:
        message.status = data['status']
        if data['status'] == 'replied':
            message.replied_at = datetime.utcnow()
    
    db.session.commit()
    return jsonify(message.to_dict()), 200

