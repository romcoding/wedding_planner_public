from src.models import db
from datetime import datetime

class Image(db.Model):
    """Image model for managing wedding photos"""
    __tablename__ = 'images'
    
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)
    
    # Image information
    name = db.Column(db.String(200), nullable=False)
    url = db.Column(db.Text, nullable=False)  # Image URL (hosted externally or in storage)
    alt_text = db.Column(db.String(255))
    description = db.Column(db.Text)
    
    # Image metadata
    category = db.Column(db.String(50))  # hero, gallery, info_section, etc.
    position = db.Column(db.String(50))  # hero, photo1, photo2, photo3, edit_rsvp, travel, gifts
    order = db.Column(db.Integer, default=0)  # For ordering
    
    # Display settings
    is_active = db.Column(db.Boolean, default=True)
    is_public = db.Column(db.Boolean, default=True)  # Visible to guests
    
    # Metadata
    file_size = db.Column(db.Integer)  # Size in bytes
    width = db.Column(db.Integer)
    height = db.Column(db.Integer)
    
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    user = db.relationship('User', backref=db.backref('images', lazy=True))
    
    def to_dict(self):
        """Convert image to dictionary"""
        return {
            'id': self.id,
            'user_id': self.user_id,
            'name': self.name,
            'url': self.url,
            'alt_text': self.alt_text,
            'description': self.description,
            'category': self.category,
            'position': self.position,
            'order': self.order,
            'is_active': self.is_active,
            'is_public': self.is_public,
            'file_size': self.file_size,
            'width': self.width,
            'height': self.height,
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'updated_at': self.updated_at.isoformat() if self.updated_at else None
        }

