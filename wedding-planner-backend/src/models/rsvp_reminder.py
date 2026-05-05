from models import db
from datetime import datetime, timedelta

class RSVPReminder(db.Model):
    """RSVP Reminder model for automatic reminder emails"""
    __tablename__ = 'rsvp_reminders'
    
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)
    
    # Reminder configuration
    name = db.Column(db.String(200), nullable=False)  # e.g., "2 weeks before wedding"
    days_before_event = db.Column(db.Integer, nullable=False)  # Days before event to send
    subject = db.Column(db.String(500), nullable=False)
    message = db.Column(db.Text, nullable=False)  # Email message body
    
    # Target criteria
    target_status = db.Column(db.String(20), default='pending')  # pending, confirmed, declined, all
    only_unassigned = db.Column(db.Boolean, default=False)  # Only send to guests without seat assignments
    
    # Scheduling
    is_active = db.Column(db.Boolean, default=True)
    last_sent_at = db.Column(db.DateTime)
    next_send_at = db.Column(db.DateTime)  # Calculated based on event date and days_before_event
    
    # Metadata
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    user = db.relationship('User', backref=db.backref('rsvp_reminders', lazy=True))
    sent_reminders = db.relationship('ReminderSent', backref='reminder', lazy=True, cascade='all, delete-orphan')
    
    def calculate_next_send_date(self, event_date):
        """Calculate when this reminder should be sent based on event date"""
        if not event_date:
            return None
        if isinstance(event_date, str):
            event_date = datetime.fromisoformat(event_date.replace('Z', '+00:00'))
        return event_date - timedelta(days=self.days_before_event)
    
    def to_dict(self):
        """Convert reminder to dictionary"""
        return {
            'id': self.id,
            'user_id': self.user_id,
            'name': self.name,
            'days_before_event': self.days_before_event,
            'subject': self.subject,
            'message': self.message,
            'target_status': self.target_status,
            'only_unassigned': self.only_unassigned,
            'is_active': self.is_active,
            'last_sent_at': self.last_sent_at.isoformat() if self.last_sent_at else None,
            'next_send_at': self.next_send_at.isoformat() if self.next_send_at else None,
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'updated_at': self.updated_at.isoformat() if self.updated_at else None,
        }

class ReminderSent(db.Model):
    """Track which reminders have been sent to which guests"""
    __tablename__ = 'reminder_sent'
    
    id = db.Column(db.Integer, primary_key=True)
    reminder_id = db.Column(db.Integer, db.ForeignKey('rsvp_reminders.id'), nullable=False)
    guest_id = db.Column(db.Integer, db.ForeignKey('guests.id'), nullable=False)
    sent_at = db.Column(db.DateTime, default=datetime.utcnow)
    
    guest = db.relationship('Guest', backref=db.backref('reminders_received', lazy=True))
    
    def to_dict(self):
        """Convert to dictionary"""
        return {
            'id': self.id,
            'reminder_id': self.reminder_id,
            'guest_id': self.guest_id,
            'sent_at': self.sent_at.isoformat() if self.sent_at else None,
        }
