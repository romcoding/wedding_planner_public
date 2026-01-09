from src.models import db
from datetime import datetime, timedelta
import json

class PageView(db.Model):
    """Track page views for analytics"""
    __tablename__ = 'page_views'
    
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=True)  # Admin user
    guest_id = db.Column(db.Integer, db.ForeignKey('guests.id'), nullable=True)  # Guest user
    
    page_path = db.Column(db.String(500), nullable=False)
    page_title = db.Column(db.String(200))
    referrer = db.Column(db.String(500))
    user_agent = db.Column(db.String(500))
    ip_address = db.Column(db.String(45))  # IPv6 compatible
    session_id = db.Column(db.String(100), index=True)
    is_guest = db.Column(db.Boolean, default=False)
    
    viewed_at = db.Column(db.DateTime, default=datetime.utcnow, index=True)
    
    user = db.relationship('User', backref=db.backref('page_views', lazy=True))
    guest = db.relationship('Guest', backref=db.backref('page_views', lazy=True))
    
    def to_dict(self):
        """Convert to dictionary"""
        return {
            'id': self.id,
            'page_path': self.page_path,
            'page_title': self.page_title,
            'referrer': self.referrer,
            'ip_address': self.ip_address,
            'session_id': self.session_id,
            'is_guest': self.is_guest,
            'viewed_at': self.viewed_at.isoformat() if self.viewed_at else None,
        }

class Visit(db.Model):
    """Track visitor sessions"""
    __tablename__ = 'visits'
    
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=True)
    guest_id = db.Column(db.Integer, db.ForeignKey('guests.id'), nullable=True)
    
    session_id = db.Column(db.String(100), unique=True, nullable=False, index=True)
    ip_address = db.Column(db.String(45))
    user_agent = db.Column(db.String(500))
    referrer = db.Column(db.String(500))
    is_guest = db.Column(db.Boolean, default=False)
    
    started_at = db.Column(db.DateTime, default=datetime.utcnow, index=True)
    ended_at = db.Column(db.DateTime)
    duration_seconds = db.Column(db.Integer)  # Calculated duration
    page_count = db.Column(db.Integer, default=1)  # Number of pages viewed
    
    user = db.relationship('User', backref=db.backref('visits', lazy=True))
    guest = db.relationship('Guest', backref=db.backref('visits', lazy=True))
    
    def end_session(self):
        """End the session and calculate duration"""
        self.ended_at = datetime.utcnow()
        if self.started_at:
            delta = self.ended_at - self.started_at
            self.duration_seconds = int(delta.total_seconds())
    
    def to_dict(self):
        """Convert to dictionary"""
        return {
            'id': self.id,
            'session_id': self.session_id,
            'ip_address': self.ip_address,
            'is_guest': self.is_guest,
            'started_at': self.started_at.isoformat() if self.started_at else None,
            'ended_at': self.ended_at.isoformat() if self.ended_at else None,
            'duration_seconds': self.duration_seconds,
            'page_count': self.page_count,
        }

class SecurityEvent(db.Model):
    """Track security-related events"""
    __tablename__ = 'security_events'
    
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=True)
    
    event_type = db.Column(db.String(50), nullable=False, index=True)  # failed_login, rate_limit, blocked_request, suspicious_activity
    ip_address = db.Column(db.String(45), nullable=False, index=True)
    user_agent = db.Column(db.String(500))
    details = db.Column(db.Text)  # JSON string with additional details
    severity = db.Column(db.String(20), default='medium')  # low, medium, high, critical
    
    occurred_at = db.Column(db.DateTime, default=datetime.utcnow, index=True)
    
    user = db.relationship('User', backref=db.backref('security_events', lazy=True))
    
    def to_dict(self):
        """Convert to dictionary"""
        details_dict = {}
        if self.details:
            try:
                details_dict = json.loads(self.details)
            except (json.JSONDecodeError, TypeError):
                details_dict = {'raw': self.details}
        
        return {
            'id': self.id,
            'event_type': self.event_type,
            'ip_address': self.ip_address,
            'user_agent': self.user_agent,
            'details': details_dict,
            'severity': self.severity,
            'occurred_at': self.occurred_at.isoformat() if self.occurred_at else None,
        }
