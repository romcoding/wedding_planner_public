from src.models import db
from datetime import datetime

class GiftRegistry(db.Model):
    """Gift registry model"""
    __tablename__ = 'gift_registry'
    
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)
    
    # Registry item details
    name = db.Column(db.String(200), nullable=False)
    description = db.Column(db.Text)
    registry_type = db.Column(db.String(50), nullable=False)  # 'external_link', 'cash_fund', 'experience'
    
    # External link details
    url = db.Column(db.Text)  # For external_link type
    
    # Cash/Experience fund details
    target_amount = db.Column(db.Numeric(10, 2))  # For cash_fund or experience
    current_amount = db.Column(db.Numeric(10, 2), default=0)
    
    # Display
    is_active = db.Column(db.Boolean, default=True)
    is_public = db.Column(db.Boolean, default=True)
    order = db.Column(db.Integer, default=0)
    
    # Metadata
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    user = db.relationship('User', backref=db.backref('gift_registry', lazy=True))
    
    def to_dict(self):
        """Convert gift registry item to dictionary"""
        return {
            'id': self.id,
            'user_id': self.user_id,
            'name': self.name,
            'description': self.description,
            'registry_type': self.registry_type,
            'url': self.url,
            'target_amount': float(self.target_amount) if self.target_amount else None,
            'current_amount': float(self.current_amount) if self.current_amount else None,
            'is_active': self.is_active,
            'is_public': self.is_public,
            'order': self.order,
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'updated_at': self.updated_at.isoformat() if self.updated_at else None,
        }

