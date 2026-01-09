from src.models import db
from werkzeug.security import generate_password_hash, check_password_hash
from datetime import datetime

class User(db.Model):
    """Admin user model for wedding planning dashboard"""
    __tablename__ = 'users'
    
    id = db.Column(db.Integer, primary_key=True)
    email = db.Column(db.String(120), unique=True, nullable=False, index=True)
    password_hash = db.Column(db.String(255), nullable=False)
    name = db.Column(db.String(100), nullable=False)
    role = db.Column(db.String(20), default='admin', nullable=False)  # guest, vendor, planner, admin, super_admin
    is_active = db.Column(db.Boolean, default=True, nullable=False)  # Can be deactivated
    permissions = db.Column(db.Text)  # JSON string of additional custom permissions (optional)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    def set_password(self, password):
        """Hash and set password"""
        self.password_hash = generate_password_hash(password)
    
    def check_password(self, password):
        """Check password against hash"""
        return check_password_hash(self.password_hash, password)
    
    def to_dict(self, include_permissions=False):
        """Convert user to dictionary"""
        result = {
            'id': self.id,
            'email': self.email,
            'name': self.name,
            'role': self.role,
            'is_active': self.is_active,
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'updated_at': self.updated_at.isoformat() if self.updated_at else None
        }
        
        if include_permissions:
            from src.utils.permissions import get_user_permissions
            result['permissions'] = get_user_permissions(self.role)
        
        return result

