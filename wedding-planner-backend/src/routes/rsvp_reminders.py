from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
from src.models import db, RSVPReminder, ReminderSent, Guest, User, Event, SeatAssignment
from src.services.email_service import EmailService
from datetime import datetime, timedelta
import os

reminders_bp = Blueprint('rsvp_reminders', __name__)

@reminders_bp.route('', methods=['GET'])
@jwt_required()
def get_reminders():
    """Get all RSVP reminders (admin only)"""
    user_id = get_jwt_identity()
    user = User.query.get(user_id)
    
    if not user or user.role != 'admin':
        return jsonify({'error': 'Unauthorized'}), 403
    
    reminders = RSVPReminder.query.filter_by(user_id=user_id).order_by(RSVPReminder.days_before_event.desc()).all()
    
    return jsonify([r.to_dict() for r in reminders]), 200

@reminders_bp.route('', methods=['POST'])
@jwt_required()
def create_reminder():
    """Create a new RSVP reminder (admin only)"""
    user_id = get_jwt_identity()
    user = User.query.get(user_id)
    
    if not user or user.role != 'admin':
        return jsonify({'error': 'Unauthorized'}), 403
    
    data = request.get_json()
    
    if not data or not data.get('name') or not data.get('days_before_event') or not data.get('subject') or not data.get('message'):
        return jsonify({'error': 'Name, days_before_event, subject, and message are required'}), 400
    
    reminder = RSVPReminder(
        user_id=user_id,
        name=data['name'],
        days_before_event=data['days_before_event'],
        subject=data['subject'],
        message=data['message'],
        target_status=data.get('target_status', 'pending'),
        only_unassigned=data.get('only_unassigned', False),
        is_active=data.get('is_active', True)
    )
    
    # Calculate next send date based on main event
    main_event = Event.query.filter_by(user_id=user_id, is_active=True).order_by(Event.start_time).first()
    if main_event and main_event.start_time:
        reminder.next_send_at = reminder.calculate_next_send_date(main_event.start_time)
    
    db.session.add(reminder)
    db.session.commit()
    
    return jsonify(reminder.to_dict()), 201

@reminders_bp.route('/<int:reminder_id>', methods=['PUT'])
@jwt_required()
def update_reminder(reminder_id):
    """Update an RSVP reminder (admin only)"""
    user_id = get_jwt_identity()
    user = User.query.get(user_id)
    
    if not user or user.role != 'admin':
        return jsonify({'error': 'Unauthorized'}), 403
    
    reminder = RSVPReminder.query.filter_by(id=reminder_id, user_id=user_id).first()
    if not reminder:
        return jsonify({'error': 'Reminder not found'}), 404
    
    data = request.get_json()
    
    if 'name' in data:
        reminder.name = data['name']
    if 'days_before_event' in data:
        reminder.days_before_event = data['days_before_event']
    if 'subject' in data:
        reminder.subject = data['subject']
    if 'message' in data:
        reminder.message = data['message']
    if 'target_status' in data:
        reminder.target_status = data['target_status']
    if 'only_unassigned' in data:
        reminder.only_unassigned = data['only_unassigned']
    if 'is_active' in data:
        reminder.is_active = data['is_active']
    
    # Recalculate next send date if event or days changed
    if 'days_before_event' in data or 'is_active' in data:
        main_event = Event.query.filter_by(user_id=user_id, is_active=True).order_by(Event.start_time).first()
        if main_event and main_event.start_time:
            reminder.next_send_at = reminder.calculate_next_send_date(main_event.start_time)
        else:
            reminder.next_send_at = None
    
    reminder.updated_at = datetime.utcnow()
    db.session.commit()
    
    return jsonify(reminder.to_dict()), 200

@reminders_bp.route('/<int:reminder_id>', methods=['DELETE'])
@jwt_required()
def delete_reminder(reminder_id):
    """Delete an RSVP reminder (admin only)"""
    user_id = get_jwt_identity()
    user = User.query.get(user_id)
    
    if not user or user.role != 'admin':
        return jsonify({'error': 'Unauthorized'}), 403
    
    reminder = RSVPReminder.query.filter_by(id=reminder_id, user_id=user_id).first()
    if not reminder:
        return jsonify({'error': 'Reminder not found'}), 404
    
    db.session.delete(reminder)
    db.session.commit()
    
    return jsonify({'message': 'Reminder deleted successfully'}), 200

@reminders_bp.route('/<int:reminder_id>/send', methods=['POST'])
@jwt_required()
def send_reminder(reminder_id):
    """Manually trigger a reminder (admin only)"""
    user_id = get_jwt_identity()
    user = User.query.get(user_id)
    
    if not user or user.role != 'admin':
        return jsonify({'error': 'Unauthorized'}), 403
    
    reminder = RSVPReminder.query.filter_by(id=reminder_id, user_id=user_id).first()
    if not reminder:
        return jsonify({'error': 'Reminder not found'}), 404
    
    if not reminder.is_active:
        return jsonify({'error': 'Reminder is not active'}), 400
    
    results = send_reminder_to_guests(reminder, user_id)
    
    reminder.last_sent_at = datetime.utcnow()
    db.session.commit()
    
    return jsonify({
        'message': f'Reminder sent to {results["sent"]} guests',
        'sent': results['sent'],
        'skipped': results['skipped'],
        'errors': results['errors']
    }), 200

@reminders_bp.route('/send-pending', methods=['POST'])
@jwt_required()
def send_pending_reminders():
    """Send all pending reminders (admin only, can be called by cron)"""
    user_id = get_jwt_identity()
    user = User.query.get(user_id)
    
    if not user or user.role != 'admin':
        return jsonify({'error': 'Unauthorized'}), 403
    
    now = datetime.utcnow()
    pending_reminders = RSVPReminder.query.filter_by(
        user_id=user_id,
        is_active=True
    ).filter(
        RSVPReminder.next_send_at <= now,
        RSVPReminder.next_send_at.isnot(None)
    ).all()
    
    results = {'sent': 0, 'skipped': 0, 'errors': []}
    
    for reminder in pending_reminders:
        reminder_results = send_reminder_to_guests(reminder, user_id)
        results['sent'] += reminder_results['sent']
        results['skipped'] += reminder_results['skipped']
        results['errors'].extend(reminder_results['errors'])
        
        reminder.last_sent_at = datetime.utcnow()
        # Calculate next send date (if recurring, otherwise set to None)
        # For now, we'll set it to None after sending (one-time reminders)
        reminder.next_send_at = None
    
    db.session.commit()
    
    return jsonify(results), 200

def send_reminder_to_guests(reminder, user_id):
    """Helper function to send reminder to eligible guests"""
    # Get eligible guests (guests don't have user_id, they're linked via invitations)
    query = Guest.query
    
    if reminder.target_status != 'all':
        query = query.filter_by(rsvp_status=reminder.target_status)
    
    guests = query.all()
    
    # Filter by seat assignment if needed
    if reminder.only_unassigned:
        assigned_guest_ids = {a.guest_id for a in SeatAssignment.query.filter(
            SeatAssignment.guest_id.isnot(None)
        ).all()}
        guests = [g for g in guests if g.id not in assigned_guest_ids]
    
    sent = 0
    skipped = 0
    errors = []
    frontend_url = os.getenv('FRONTEND_URL', 'http://localhost:5173')
    
    for guest in guests:
        # Check if already sent
        already_sent = ReminderSent.query.filter_by(
            reminder_id=reminder.id,
            guest_id=guest.id
        ).first()
        
        if already_sent:
            skipped += 1
            continue
        
        # Send email
        try:
            # Create personalized message
            personalized_message = reminder.message.replace('{guest_name}', guest.first_name)
            personalized_message = personalized_message.replace('{rsvp_link}', f"{frontend_url}/rsvp/{guest.unique_token}")
            
            email_sent = EmailService.send_notification_email(
                email=guest.email,
                subject=reminder.subject.replace('{guest_name}', guest.first_name),
                message=personalized_message,
                frontend_url=frontend_url
            )
            
            if email_sent:
                # Track that reminder was sent
                reminder_sent = ReminderSent(
                    reminder_id=reminder.id,
                    guest_id=guest.id
                )
                db.session.add(reminder_sent)
                sent += 1
            else:
                errors.append(f"Failed to send to {guest.email}")
        except Exception as e:
            errors.append(f"Error sending to {guest.email}: {str(e)}")
    
    db.session.commit()
    
    return {'sent': sent, 'skipped': skipped, 'errors': errors}

@reminders_bp.route('/history', methods=['GET'])
@jwt_required()
def get_reminder_history():
    """Get reminder sending history (admin only)"""
    user_id = get_jwt_identity()
    user = User.query.get(user_id)
    
    if not user or user.role != 'admin':
        return jsonify({'error': 'Unauthorized'}), 403
    
    reminder_id = request.args.get('reminder_id', type=int)
    
    query = ReminderSent.query.join(RSVPReminder).filter(RSVPReminder.user_id == user_id)
    
    if reminder_id:
        query = query.filter(ReminderSent.reminder_id == reminder_id)
    
    sent_reminders = query.order_by(ReminderSent.sent_at.desc()).limit(100).all()
    
    return jsonify([{
        'id': sr.id,
        'reminder_id': sr.reminder_id,
        'reminder_name': sr.reminder.name,
        'guest_id': sr.guest_id,
        'guest_name': f"{sr.guest.first_name} {sr.guest.last_name}",
        'guest_email': sr.guest.email,
        'sent_at': sr.sent_at.isoformat() if sr.sent_at else None
    } for sr in sent_reminders]), 200
