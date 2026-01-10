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
    end_date = db.Column(db.Date)  # For multi-day events
    
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
    
    def to_dict(self, include_tasks=False):
        """Convert event to dictionary with safe handling of missing columns"""
        # Safely get attribute values with defaults
        def safe_get(attr, default=None):
            try:
                return getattr(self, attr, default) if hasattr(self, attr) else default
            except:
                return default
        
        result = {
            'id': self.id,
            'user_id': self.user_id,
            'name': safe_get('name', ''),
            'description': safe_get('description'),
            'location': safe_get('location'),
            'start_time': self.start_time.isoformat() if self.start_time else None,
            'end_time': safe_get('end_time').isoformat() if safe_get('end_time') else None,
            'end_date': safe_get('end_date').isoformat() if safe_get('end_date') else None,
            'order': safe_get('order', 0),
            'is_public': safe_get('is_public', True),
            'is_active': safe_get('is_active', True),
            'dress_code': safe_get('dress_code'),
            'notes': safe_get('notes'),
            'created_at': self.created_at.isoformat() if hasattr(self, 'created_at') and self.created_at else None,
            'updated_at': self.updated_at.isoformat() if hasattr(self, 'updated_at') and self.updated_at else None,
        }
        if include_tasks and hasattr(self, 'tasks') and self.tasks:
            result['tasks'] = [task.to_dict() for task in self.tasks]
        return result

