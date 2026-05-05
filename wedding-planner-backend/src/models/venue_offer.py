from models import db
from datetime import datetime
import json

class VenueOfferCategory(db.Model):
    """Category for organizing venue offers (e.g., 'Food & Beverage', 'Venue Rental', 'Additional Services')"""
    __tablename__ = 'venue_offer_categories'
    
    id = db.Column(db.Integer, primary_key=True)
    venue_id = db.Column(db.Integer, db.ForeignKey('venues.id', ondelete='CASCADE'), nullable=False)
    name = db.Column(db.String(200), nullable=False)
    description = db.Column(db.Text)
    order = db.Column(db.Integer, default=0)  # For sorting categories
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    venue = db.relationship('Venue', backref=db.backref('offer_categories', lazy=True, cascade='all, delete-orphan'))
    offers = db.relationship('VenueOffer', backref='category', lazy=True, cascade='all, delete-orphan', order_by='VenueOffer.order')
    
    def to_dict(self, include_offers=False):
        result = {
            'id': self.id,
            'venue_id': self.venue_id,
            'name': self.name,
            'description': self.description,
            'order': self.order,
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'updated_at': self.updated_at.isoformat() if self.updated_at else None,
        }
        if include_offers:
            result['offers'] = [offer.to_dict() for offer in self.offers]
        return result


class VenueOffer(db.Model):
    """Individual offer item within a category (e.g., '3-course dinner menu', 'Open bar package')"""
    __tablename__ = 'venue_offers'
    
    id = db.Column(db.Integer, primary_key=True)
    category_id = db.Column(db.Integer, db.ForeignKey('venue_offer_categories.id', ondelete='CASCADE'), nullable=False)
    venue_id = db.Column(db.Integer, db.ForeignKey('venues.id', ondelete='CASCADE'), nullable=False)
    
    name = db.Column(db.String(200), nullable=False)
    description = db.Column(db.Text)
    price = db.Column(db.Numeric(10, 2))  # Price amount
    price_type = db.Column(db.String(20), default='fixed')  # 'fixed' or 'minimum_spend'
    currency = db.Column(db.String(10), default='EUR')
    unit = db.Column(db.String(50))  # e.g., 'per person', 'per table', 'per hour'
    order = db.Column(db.Integer, default=0)  # For sorting within category
    
    # Optional fields
    min_quantity = db.Column(db.Integer)  # Minimum quantity required
    max_quantity = db.Column(db.Integer)  # Maximum quantity allowed
    is_available = db.Column(db.Boolean, default=True)
    notes = db.Column(db.Text)
    
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    venue = db.relationship('Venue', backref=db.backref('offers', lazy=True))
    
    def to_dict(self):
        return {
            'id': self.id,
            'category_id': self.category_id,
            'venue_id': self.venue_id,
            'name': self.name,
            'description': self.description,
            'price': float(self.price) if self.price else None,
            'price_type': self.price_type,
            'currency': self.currency,
            'unit': self.unit,
            'order': self.order,
            'min_quantity': self.min_quantity,
            'max_quantity': self.max_quantity,
            'is_available': self.is_available,
            'notes': self.notes,
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'updated_at': self.updated_at.isoformat() if self.updated_at else None,
        }
