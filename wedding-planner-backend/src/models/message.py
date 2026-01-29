from src.models import db
from datetime import datetime

class Message(db.Model):
    """Message model for guest communications"""
    __tablename__ = 'messages'
    
    id = db.Column(db.Integer, primary_key=True)
    guest_id = db.Column(db.Integer, db.ForeignKey('guests.id'), nullable=True)  # Null for anonymous
    user_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=True)  # Admin who sent/received
    
    # Message details
    subject = db.Column(db.String(200), nullable=False)
    body = db.Column(db.Text, nullable=False)
    sender_type = db.Column(db.String(20), nullable=False)  # 'guest' or 'admin'
    
    # Status
    status = db.Column(db.String(20), default='unread')  # unread, read, replied
    replied_at = db.Column(db.DateTime)
    
    # Delivery tracking (for contact form email forwarding)
    delivery_status = db.Column(db.String(20), default='received')  # received, sent, failed
    delivery_attempted_at = db.Column(db.DateTime)
    delivery_error = db.Column(db.Text)
    idempotency_key = db.Column(db.String(64), unique=True, nullable=True, index=True)
    
    # Metadata
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    guest = db.relationship('Guest', backref=db.backref('messages', lazy=True))
    user = db.relationship('User', backref=db.backref('messages', lazy=True))
    
    def to_dict(self):
        """Convert message to dictionary"""
        return {
            'id': self.id,
            'guest_id': self.guest_id,
            'user_id': self.user_id,
            'subject': self.subject,
            'body': self.body,
            'sender_type': self.sender_type,
            'status': self.status,
            'replied_at': self.replied_at.isoformat() if self.replied_at else None,
            'delivery_status': self.delivery_status,
            'delivery_attempted_at': self.delivery_attempted_at.isoformat() if self.delivery_attempted_at else None,
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'updated_at': self.updated_at.isoformat() if self.updated_at else None,
            'guest_name': f"{self.guest.first_name} {self.guest.last_name}" if self.guest else 'Anonymous',
            'guest_email': self.guest.email if self.guest else None,
        }

