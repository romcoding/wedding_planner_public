from src.models import db
from datetime import datetime

class Event(db.Model):
    """Event model for wedding timeline"""
    __tablename__ = 'events'
    
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)
    
    # Event details
    name = db.Column(db.String(200), nullable=False)
    description = db.Column(db.Text)
    location = db.Column(db.String(255))
    
    # Timing
    start_time = db.Column(db.DateTime, nullable=False)
    end_time = db.Column(db.DateTime)
    
    # Display
    order = db.Column(db.Integer, default=0)  # For ordering events
    is_public = db.Column(db.Boolean, default=True)  # Visible to guests
    is_active = db.Column(db.Boolean, default=True)
    
    # Additional info
    dress_code = db.Column(db.String(100))
    notes = db.Column(db.Text)
    
    # Metadata
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    user = db.relationship('User', backref=db.backref('events', lazy=True))
    
    def to_dict(self):
        """Convert event to dictionary"""
        return {
            'id': self.id,
            'user_id': self.user_id,
            'name': self.name,
            'description': self.description,
            'location': self.location,
            'start_time': self.start_time.isoformat() if self.start_time else None,
            'end_time': self.end_time.isoformat() if self.end_time else None,
            'order': self.order,
            'is_public': self.is_public,
            'is_active': self.is_active,
            'dress_code': self.dress_code,
            'notes': self.notes,
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'updated_at': self.updated_at.isoformat() if self.updated_at else None,
        }

