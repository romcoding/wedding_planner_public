from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
from src.models import db, Message, User, Guest
from datetime import datetime, timedelta
from sqlalchemy.exc import IntegrityError
import os
import logging
from collections import defaultdict
from threading import Lock

from src.services.email_service import EmailService

messages_bp = Blueprint('messages', __name__)
logger = logging.getLogger(__name__)

# In-memory rate limit: {key: [timestamp, ...]}. Max 5 per hour per guest_id or IP.
_RATE_LIMIT_STORE = defaultdict(list)
_RATE_LIMIT_LOCK = Lock()
RATE_LIMIT_MAX = 5
RATE_LIMIT_WINDOW = 3600  # seconds


def _rate_limit_key(guest_id, ip):
    return f"g{guest_id}" if guest_id else f"ip{ip}"


def _check_rate_limit(guest_id, ip):
    key = _rate_limit_key(guest_id, ip)
    now = datetime.utcnow()
    with _RATE_LIMIT_LOCK:
        timestamps = _RATE_LIMIT_STORE[key]
        cutoff = now - timedelta(seconds=RATE_LIMIT_WINDOW)
        timestamps[:] = [t for t in timestamps if t > cutoff]
        if len(timestamps) >= RATE_LIMIT_MAX:
            return False
        timestamps.append(now)
    return True


@messages_bp.route('', methods=['POST'])
def create_message():
    """Create a message (guest or admin)"""
    data = request.get_json()

    if not data:
        return jsonify({'error': 'Invalid request body'}), 400

    # Honeypot: reject if _hp is filled (bot)
    if data.get('_hp'):
        logger.warning("Contact form rejected: honeypot triggered")
        return jsonify({'error': 'Invalid request'}), 400

    if not data.get('subject') or not data.get('body'):
        return jsonify({'error': 'Subject and body are required'}), 400

    # Idempotency: if key provided and exists, return existing message
    idempotency_key = data.get('idempotency_key')
    if idempotency_key:
        existing = Message.query.filter_by(idempotency_key=idempotency_key).first()
        if existing:
            logger.info(f"Contact idempotency: returning existing message id={existing.id}")
            return jsonify({
                'message': 'Message sent successfully',
                'message_data': existing.to_dict()
            }), 200

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
        except Exception:
            pass

    # Rate limit (guest messages only)
    if sender_type == 'guest':
        client_ip = request.headers.get('X-Forwarded-For', request.remote_addr or '')
        if client_ip and ',' in str(client_ip):
            client_ip = str(client_ip).split(',')[0].strip()
        if not _check_rate_limit(guest_id, client_ip):
            logger.warning(f"Contact rate limit exceeded guest_id={guest_id} ip={client_ip}")
            return jsonify({'error': 'Too many messages. Please try again later.'}), 429

    message = Message(
        guest_id=guest_id,
        user_id=user_id,
        subject=data['subject'],
        body=data['body'],
        sender_type=sender_type,
        status='unread',
        delivery_status='received',
        idempotency_key=idempotency_key,
    )

    try:
        db.session.add(message)
        db.session.commit()

        # Optional: forward guest messages to an email inbox
        forward_to = os.getenv('CONTACT_FORWARD_EMAIL')
        if forward_to and sender_type == 'guest':
            message.delivery_attempted_at = datetime.utcnow()
            try:
                guest = Guest.query.get(guest_id) if guest_id else None
                guest_name = f"{guest.first_name} {guest.last_name}".strip() if guest else "Anonymous"
                guest_email = guest.email if guest else None
                subject = f"[Wedding Planner] New guest message: {data['subject']}"
                body_html = (data.get('body') or '').replace('\r\n', '\n').replace('\n', '<br/>')
                body = (
                    f"<p><strong>From:</strong> {guest_name} ({guest_email or 'no email'})</p>"
                    f"<p><strong>Guest ID:</strong> {guest_id or '—'}</p>"
                    f"<hr/>"
                    f"<p>{body_html}</p>"
                )
                success = EmailService.send_notification_email(forward_to, subject, body)
                if success:
                    message.delivery_status = 'sent'
                    logger.info(f"Contact send attempt guest_id={guest_id} result=sent")
                else:
                    message.delivery_status = 'failed'
                    message.delivery_error = 'SMTP not configured or send returned False'
                    logger.warning(f"Contact send attempt guest_id={guest_id} result=failed (no SMTP)")
            except Exception as e:
                message.delivery_status = 'failed'
                message.delivery_error = str(e)[:500]
                logger.exception(f"Contact send attempt guest_id={guest_id} result=exception")
            db.session.commit()
        else:
            logger.info(f"Contact send attempt guest_id={guest_id} result=stored (no forward configured)")

        return jsonify({
            'message': 'Message sent successfully',
            'message_data': message.to_dict()
        }), 201
    except IntegrityError as e:
        db.session.rollback()
        if idempotency_key and 'idempotency_key' in str(e).lower():
            existing = Message.query.filter_by(idempotency_key=idempotency_key).first()
            if existing:
                return jsonify({
                    'message': 'Message sent successfully',
                    'message_data': existing.to_dict()
                }), 200
        return jsonify({'error': 'Failed to send message'}), 500


@messages_bp.route('', methods=['GET'])
@jwt_required()
def get_messages():
    """Get messages (admin sees all, guests see their own)"""
    identity = get_jwt_identity()

    if str(identity).startswith('guest_'):
        guest_id = int(identity.split('_')[1])
        messages = Message.query.filter_by(guest_id=guest_id).order_by(Message.created_at.desc()).all()
    else:
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

    if str(identity).startswith('guest_'):
        guest_id = int(identity.split('_')[1])
        if message.guest_id != guest_id:
            return jsonify({'error': 'Unauthorized'}), 403
    else:
        user = User.query.get(identity)
        if not user or user.role != 'admin':
            return jsonify({'error': 'Unauthorized'}), 403

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
