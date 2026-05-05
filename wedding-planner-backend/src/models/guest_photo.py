from models import db
from datetime import datetime
import base64

class GuestPhoto(db.Model):
    """Guest photo model for photo gallery"""
    __tablename__ = 'guest_photos'
    
    id = db.Column(db.Integer, primary_key=True)
    guest_id = db.Column(db.Integer, db.ForeignKey('guests.id'), nullable=False)
    
    # Photo details
    name = db.Column(db.String(200))
    url = db.Column(db.Text, nullable=False)  # Base64 data URL or external URL
    caption = db.Column(db.Text)
    
    # Display
    is_approved = db.Column(db.Boolean, default=False)  # Admin approval
    is_public = db.Column(db.Boolean, default=True)  # Visible in gallery
    
    # Metadata
    file_size = db.Column(db.Integer)
    width = db.Column(db.Integer)
    height = db.Column(db.Integer)
    
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    guest = db.relationship('Guest', backref=db.backref('photos', lazy=True))
    
    def to_dict(self):
        """Convert photo to dictionary"""
        return {
            'id': self.id,
            'guest_id': self.guest_id,
            'name': self.name,
            'url': self.url,
            'caption': self.caption,
            'is_approved': self.is_approved,
            'is_public': self.is_public,
            'file_size': self.file_size,
            'width': self.width,
            'height': self.height,
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'updated_at': self.updated_at.isoformat() if self.updated_at else None,
            'guest_name': f"{self.guest.first_name} {self.guest.last_name}" if self.guest else None,
        }

