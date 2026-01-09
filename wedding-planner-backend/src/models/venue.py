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
        """Convert venue to dictionary with safe handling of missing columns"""
        try:
            # Parse amenities
            amenities_list = []
            if hasattr(self, 'amenities') and self.amenities:
                try:
                    amenities_list = json.loads(self.amenities)
                except (json.JSONDecodeError, TypeError):
                    # If not JSON, treat as comma-separated string
                    amenities_list = [a.strip() for a in str(self.amenities).split(',') if a.strip()]
        except:
            amenities_list = []
        
        try:
            # Parse available dates
            available_dates_list = []
            if hasattr(self, 'available_dates') and self.available_dates:
                try:
                    available_dates_list = json.loads(self.available_dates)
                except (json.JSONDecodeError, TypeError):
                    available_dates_list = []
        except:
            available_dates_list = []
        
        try:
            # Parse images
            images_list = []
            if hasattr(self, 'images') and self.images:
                try:
                    images_list = json.loads(self.images)
                except (json.JSONDecodeError, TypeError):
                    images_list = []
        except:
            images_list = []
        
        # Safely get attribute values with defaults
        def safe_get(attr, default=None):
            try:
                return getattr(self, attr, default) if hasattr(self, attr) else default
            except:
                return default
        
        # Build location string safely
        location_str = safe_get('location')
        if not location_str:
            city = safe_get('city')
            region = safe_get('region')
            address = safe_get('address')
            if city and region:
                location_str = f"{city}, {region}"
            elif address:
                location_str = address
        
        result = {
            'id': self.id,
            'user_id': self.user_id,
            'name': safe_get('name', ''),
            'description': safe_get('description'),
            # Location fields
            'address': safe_get('address'),
            'city': safe_get('city'),
            'region': safe_get('region'),
            'location': location_str,
            # Capacity fields
            'capacity_min': safe_get('capacity_min'),
            'capacity_max': safe_get('capacity_max'),
            'capacity': safe_get('capacity') or safe_get('capacity_max'),
            # Price fields
            'price_min': float(safe_get('price_min')) if safe_get('price_min') else None,
            'price_max': float(safe_get('price_max')) if safe_get('price_max') else None,
            'price_range': safe_get('price_range'),
            # Style and amenities
            'style': safe_get('style'),
            'amenities': amenities_list,
            # Contact information
            'contact_name': safe_get('contact_name'),
            'contact_email': safe_get('contact_email'),
            'contact_phone': safe_get('contact_phone'),
            'website': safe_get('website') or safe_get('external_url'),
            'external_url': safe_get('external_url'),
            # Additional fields
            'available_dates': available_dates_list,
            'rating': float(safe_get('rating')) if safe_get('rating') else None,
            'images': images_list,
            'imported_via_scraper': safe_get('imported_via_scraper', False),
            'notes': safe_get('notes'),
            'is_deleted': safe_get('is_deleted', False),
            'created_at': self.created_at.isoformat() if hasattr(self, 'created_at') and self.created_at else None,
            'updated_at': self.updated_at.isoformat() if hasattr(self, 'updated_at') and self.updated_at else None,
        }
        
        if include_requests and hasattr(self, 'requests') and self.requests:
            try:
                result['requests'] = [req.to_dict() for req in self.requests]
            except:
                result['requests'] = []
        
        return result

