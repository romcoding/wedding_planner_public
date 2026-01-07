from src.models import db
from datetime import datetime
import json

class Venue(db.Model):
    """Venue model for wedding venue management"""
    __tablename__ = 'venues'
    
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)
    
    name = db.Column(db.String(200), nullable=False)
    description = db.Column(db.Text)
    location = db.Column(db.String(200))
    capacity = db.Column(db.Integer)
    price_range = db.Column(db.String(50))  # e.g., "$5,000-$10,000", "Budget", "Premium"
    style = db.Column(db.String(100))  # e.g., "Rustic", "Modern", "Classic"
    
    # Store amenities as JSON string
    amenities = db.Column(db.Text)  # JSON string of amenities list
    
    # Contact information
    contact_name = db.Column(db.String(200))
    contact_email = db.Column(db.String(200))
    contact_phone = db.Column(db.String(50))
    website = db.Column(db.String(500))
    
    # Additional fields
    rating = db.Column(db.Float)  # 0.0 to 5.0
    notes = db.Column(db.Text)
    
    # Soft delete
    is_deleted = db.Column(db.Boolean, default=False)
    
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    user = db.relationship('User', backref=db.backref('venues', lazy=True))
    
    # Relationship to venue requests
    requests = db.relationship('VenueRequest', backref='venue', lazy=True, cascade='all, delete-orphan')
    
    def to_dict(self, include_requests=False):
        """Convert venue to dictionary"""
        amenities_list = []
        if self.amenities:
            try:
                amenities_list = json.loads(self.amenities)
            except (json.JSONDecodeError, TypeError):
                # If not JSON, treat as comma-separated string
                amenities_list = [a.strip() for a in self.amenities.split(',') if a.strip()]
        
        result = {
            'id': self.id,
            'user_id': self.user_id,
            'name': self.name,
            'description': self.description,
            'location': self.location,
            'capacity': self.capacity,
            'price_range': self.price_range,
            'style': self.style,
            'amenities': amenities_list,
            'contact_name': self.contact_name,
            'contact_email': self.contact_email,
            'contact_phone': self.contact_phone,
            'website': self.website,
            'rating': float(self.rating) if self.rating else None,
            'notes': self.notes,
            'is_deleted': self.is_deleted,
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'updated_at': self.updated_at.isoformat() if self.updated_at else None,
        }
        
        if include_requests and self.requests:
            result['requests'] = [req.to_dict() for req in self.requests]
        
        return result

