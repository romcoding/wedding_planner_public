from src.models import db
from datetime import datetime

class VenueRequest(db.Model):
    """VenueRequest model for tracking communication with venues"""
    __tablename__ = 'venue_requests'
    
    id = db.Column(db.Integer, primary_key=True)
    venue_id = db.Column(db.Integer, db.ForeignKey('venues.id'), nullable=False)
    user_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)
    
    contact_date = db.Column(db.Date, nullable=False)
    status = db.Column(db.String(50), default='pending')  # pending, contacted, proposal_received, accepted, rejected
    proposed_price = db.Column(db.Numeric(10, 2))
    notes = db.Column(db.Text)
    
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    user = db.relationship('User', backref=db.backref('venue_requests', lazy=True))
    
    def to_dict(self):
        """Convert venue request to dictionary"""
        return {
            'id': self.id,
            'venue_id': self.venue_id,
            'user_id': self.user_id,
            'contact_date': self.contact_date.isoformat() if self.contact_date else None,
            'status': self.status,
            'proposed_price': float(self.proposed_price) if self.proposed_price else None,
            'notes': self.notes,
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'updated_at': self.updated_at.isoformat() if self.updated_at else None,
        }

