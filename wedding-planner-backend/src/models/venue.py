from src.models import db
from datetime import datetime
import json

class Venue(db.Model):
    """Venue model for wedding venue management"""
    __tablename__ = 'venues'
    
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)
    
    # Basic information
    name = db.Column(db.String(200), nullable=False)
    description = db.Column(db.Text)
    
    # Location - split into address, city, region
    address = db.Column(db.String(500))  # Full street address
    city = db.Column(db.String(100))  # City name
    region = db.Column(db.String(100))  # State/Province/Region
    location = db.Column(db.String(200))  # Keep for backward compatibility (full location string)
    
    # Capacity - now with min/max range
    capacity_min = db.Column(db.Integer)  # Minimum capacity
    capacity_max = db.Column(db.Integer)  # Maximum capacity
    capacity = db.Column(db.Integer)  # Keep for backward compatibility
    
    # Pricing - now with min/max range
    price_min = db.Column(db.Numeric(10, 2))  # Minimum price
    price_max = db.Column(db.Numeric(10, 2))  # Maximum price
    price_range = db.Column(db.String(50))  # Keep for backward compatibility (e.g., "$5,000-$10,000")
    
    # Style and amenities
    style = db.Column(db.String(100))  # e.g., "Rustic", "Modern", "Classic"
    amenities = db.Column(db.Text)  # JSON string of amenities list
    
    # Contact information
    contact_name = db.Column(db.String(200))
    contact_email = db.Column(db.String(200))
    contact_phone = db.Column(db.String(50))
    website = db.Column(db.String(500))
    external_url = db.Column(db.String(500))  # Alternative URL field
    
    # Additional fields
    available_dates = db.Column(db.Text)  # JSON array of available dates
    rating = db.Column(db.Float)  # 0.0 to 5.0
    images = db.Column(db.Text)  # JSON array of image URLs
    imported_via_scraper = db.Column(db.Boolean, default=False)  # Flag for scraped venues
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
        # Parse amenities
        amenities_list = []
        if self.amenities:
            try:
                amenities_list = json.loads(self.amenities)
            except (json.JSONDecodeError, TypeError):
                # If not JSON, treat as comma-separated string
                amenities_list = [a.strip() for a in self.amenities.split(',') if a.strip()]
        
        # Parse available dates
        available_dates_list = []
        if self.available_dates:
            try:
                available_dates_list = json.loads(self.available_dates)
            except (json.JSONDecodeError, TypeError):
                available_dates_list = []
        
        # Parse images
        images_list = []
        if self.images:
            try:
                images_list = json.loads(self.images)
            except (json.JSONDecodeError, TypeError):
                images_list = []
        
        result = {
            'id': self.id,
            'user_id': self.user_id,
            'name': self.name,
            'description': self.description,
            # Location fields
            'address': self.address,
            'city': self.city,
            'region': self.region,
            'location': self.location or (f"{self.city}, {self.region}" if self.city and self.region else self.address),  # Backward compatibility
            # Capacity fields
            'capacity_min': self.capacity_min,
            'capacity_max': self.capacity_max,
            'capacity': self.capacity or self.capacity_max,  # Backward compatibility
            # Price fields
            'price_min': float(self.price_min) if self.price_min else None,
            'price_max': float(self.price_max) if self.price_max else None,
            'price_range': self.price_range,  # Keep for backward compatibility
            # Style and amenities
            'style': self.style,
            'amenities': amenities_list,
            # Contact information
            'contact_name': self.contact_name,
            'contact_email': self.contact_email,
            'contact_phone': self.contact_phone,
            'website': self.website or self.external_url,  # Prefer website, fallback to external_url
            'external_url': self.external_url,
            # Additional fields
            'available_dates': available_dates_list,
            'rating': float(self.rating) if self.rating else None,
            'images': images_list,
            'imported_via_scraper': self.imported_via_scraper,
            'notes': self.notes,
            'is_deleted': self.is_deleted,
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'updated_at': self.updated_at.isoformat() if self.updated_at else None,
        }
        
        if include_requests and self.requests:
            result['requests'] = [req.to_dict() for req in self.requests]
        
        return result

