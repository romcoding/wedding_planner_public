from src.models import db
from datetime import datetime


class AgendaItem(db.Model):
    """AgendaItem model for individual timeline entries displayed to guests"""
    __tablename__ = 'agenda_items'

    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)

    # Time display (e.g., "14:00" or "14:00 - 15:30")
    time_display = db.Column(db.String(50), nullable=False)
    
    # Title in multiple languages
    title_en = db.Column(db.String(200), nullable=False)
    title_de = db.Column(db.String(200))
    title_fr = db.Column(db.String(200))
    
    # Optional description in multiple languages
    description_en = db.Column(db.Text)
    description_de = db.Column(db.Text)
    description_fr = db.Column(db.Text)
    
    # Optional icon name (e.g., 'church', 'utensils', 'music', 'camera', 'heart')
    icon = db.Column(db.String(50))
    
    # Display order
    order = db.Column(db.Integer, default=0)
    
    # Visibility
    is_active = db.Column(db.Boolean, default=True)
    
    # Metadata
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    user = db.relationship('User', backref=db.backref('agenda_items', lazy=True))

    def to_dict(self):
        """Convert agenda item to dictionary"""
        return {
            'id': self.id,
            'user_id': self.user_id,
            'time_display': self.time_display,
            'title_en': self.title_en or '',
            'title_de': self.title_de or self.title_en or '',
            'title_fr': self.title_fr or self.title_en or '',
            'description_en': self.description_en or '',
            'description_de': self.description_de or self.description_en or '',
            'description_fr': self.description_fr or self.description_en or '',
            'icon': self.icon,
            'order': self.order or 0,
            'is_active': self.is_active,
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'updated_at': self.updated_at.isoformat() if self.updated_at else None,
        }
