from src.models import db
from datetime import datetime, timedelta
import secrets

class Invitation(db.Model):
    """Invitation model for guest invitations"""
    __tablename__ = 'invitations'
    
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)
    
    # Invitation details
    email = db.Column(db.String(120), nullable=False, index=True)
    token = db.Column(db.String(64), unique=True, nullable=False, index=True)
    guest_name = db.Column(db.String(200))  # Full name or "John & Jane"
    plus_one_allowed = db.Column(db.Boolean, default=False)
    plus_one_count = db.Column(db.Integer, default=0)  # Max number of plus-ones
    
    # Status and timing
    status = db.Column(db.String(20), default='pending')  # pending, sent, accepted, expired, revoked
    sent_at = db.Column(db.DateTime)
    expires_at = db.Column(db.DateTime)
    accepted_at = db.Column(db.DateTime)
    
    # Guest relationship (if accepted)
    guest_id = db.Column(db.Integer, db.ForeignKey('guests.id'), nullable=True)
    
    # Metadata
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    notes = db.Column(db.Text)
    
    user = db.relationship('User', backref=db.backref('invitations', lazy=True))
    guest = db.relationship('Guest', backref=db.backref('invitation', uselist=False), foreign_keys=[guest_id])
    
    @staticmethod
    def generate_token():
        """Generate a secure random token"""
        return secrets.token_urlsafe(48)
    
    @staticmethod
    def create_invitation(user_id, email, guest_name=None, plus_one_allowed=False, plus_one_count=0, expires_days=30):
        """Create a new invitation with token"""
        token = Invitation.generate_token()
        expires_at = datetime.utcnow() + timedelta(days=expires_days)
        
        invitation = Invitation(
            user_id=user_id,
            email=email,
            token=token,
            guest_name=guest_name,
            plus_one_allowed=plus_one_allowed,
            plus_one_count=plus_one_count,
            expires_at=expires_at,
            status='pending'
        )
        return invitation
    
    def is_valid(self):
        """Check if invitation is still valid"""
        if self.status in ['accepted', 'revoked']:
            return False
        if self.expires_at and datetime.utcnow() > self.expires_at:
            return False
        return True
    
    def mark_as_sent(self):
        """Mark invitation as sent"""
        self.status = 'sent'
        self.sent_at = datetime.utcnow()
    
    def mark_as_accepted(self, guest_id):
        """Mark invitation as accepted"""
        self.status = 'accepted'
        self.accepted_at = datetime.utcnow()
        self.guest_id = guest_id
    
    def revoke(self):
        """Revoke the invitation"""
        self.status = 'revoked'
    
    def to_dict(self):
        """Convert invitation to dictionary"""
        return {
            'id': self.id,
            'user_id': self.user_id,
            'email': self.email,
            'token': self.token,
            'guest_name': self.guest_name,
            'plus_one_allowed': self.plus_one_allowed,
            'plus_one_count': self.plus_one_count,
            'status': self.status,
            'sent_at': self.sent_at.isoformat() if self.sent_at else None,
            'expires_at': self.expires_at.isoformat() if self.expires_at else None,
            'accepted_at': self.accepted_at.isoformat() if self.accepted_at else None,
            'guest_id': self.guest_id,
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'updated_at': self.updated_at.isoformat() if self.updated_at else None,
            'notes': self.notes,
            'is_valid': self.is_valid()
        }

