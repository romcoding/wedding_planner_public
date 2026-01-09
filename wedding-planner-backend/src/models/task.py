from src.models import db
from datetime import datetime

class Task(db.Model):
    """Task model for wedding planning"""
    __tablename__ = 'tasks'
    
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)
    
    title = db.Column(db.String(200), nullable=False)
    description = db.Column(db.Text)
    priority = db.Column(db.String(20), default='medium')  # low, medium, high, urgent
    status = db.Column(db.String(20), default='todo')  # todo, in_progress, completed, cancelled
    due_date = db.Column(db.Date)
    category = db.Column(db.String(50))  # venue, catering, decoration, etc.
    
    assigned_to = db.Column(db.String(100))  # Name or email of person assigned
    estimated_cost = db.Column(db.Numeric(10, 2))
    actual_cost = db.Column(db.Numeric(10, 2))
    
    # Link to event
    event_id = db.Column(db.Integer, db.ForeignKey('events.id'), nullable=True)
    reminder_date = db.Column(db.DateTime)  # For email reminders
    
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    completed_at = db.Column(db.DateTime)
    
    user = db.relationship('User', backref=db.backref('tasks', lazy=True))
    event = db.relationship('Event', backref=db.backref('tasks', lazy=True))
    
    def to_dict(self, include_event=False):
        """Convert task to dictionary"""
        result = {
            'id': self.id,
            'user_id': self.user_id,
            'title': self.title,
            'description': self.description,
            'priority': self.priority,
            'status': self.status,
            'due_date': self.due_date.isoformat() if self.due_date else None,
            'category': self.category,
            'assigned_to': self.assigned_to,
            'estimated_cost': float(self.estimated_cost) if self.estimated_cost else None,
            'actual_cost': float(self.actual_cost) if self.actual_cost else None,
            'event_id': self.event_id,
            'reminder_date': self.reminder_date.isoformat() if self.reminder_date else None,
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'updated_at': self.updated_at.isoformat() if self.updated_at else None,
            'completed_at': self.completed_at.isoformat() if self.completed_at else None
        }
        if include_event and self.event:
            result['event'] = self.event.to_dict()
        return result

