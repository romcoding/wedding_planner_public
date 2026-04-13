from src.models import db
from datetime import datetime
from werkzeug.security import generate_password_hash, check_password_hash
import secrets
import json

class Guest(db.Model):
    """Guest model for wedding registration"""
    __tablename__ = 'guests'
    
    id = db.Column(db.Integer, primary_key=True)
    # Multi-tenant FK — which wedding this guest belongs to (nullable for backward compat)
    wedding_id = db.Column(db.String(36), db.ForeignKey('weddings.id'), nullable=True, index=True)
    # Primary guest information
    first_name = db.Column(db.String(100), nullable=False)
    last_name = db.Column(db.String(100), nullable=False)
    email = db.Column(db.String(120), nullable=False, index=True)
    phone = db.Column(db.String(20))
    
    # Authentication - Passwordless with unique token
    unique_token = db.Column(db.String(64), unique=True, nullable=False, index=True)  # Unique link token
    username = db.Column(db.String(80), unique=True, nullable=True, index=True)  # Optional, for backward compatibility
    password_hash = db.Column(db.String(255))  # Optional, for backward compatibility
    
    # RSVP information
    rsvp_status = db.Column(db.String(20), default='pending')  # pending, confirmed, declined
    overnight_stay = db.Column(db.Boolean, default=False)  # Whether guest wants to stay overnight
    number_of_guests = db.Column(db.Integer, default=1)  # Including plus-ones

    # Invitee details (for couples/groups)
    # Stored as JSON string arrays for backward-compatible storage.
    invitee_names = db.Column(db.Text)  # JSON array of full names invited (e.g. ["Alex Smith","Sam Smith"])
    attending_names = db.Column(db.Text)  # JSON array subset of invitee_names indicating who is coming
    
    # Dietary and special requirements
    dietary_restrictions = db.Column(db.Text)  # JSON string or comma-separated
    allergies = db.Column(db.Text)
    special_requests = db.Column(db.Text)
    music_wish = db.Column(db.Text)  # Music requests for the wedding
    
    # Additional information
    address = db.Column(db.Text)
    notes = db.Column(db.Text)
    language = db.Column(db.String(10), default='en')  # Language preference: en, de, fr
    
    # Metadata
    registered_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    last_accessed = db.Column(db.DateTime)
    
    @staticmethod
    def generate_unique_token():
        """Generate a secure unique token for guest link"""
        return secrets.token_urlsafe(32)  # 32 bytes = 43 characters URL-safe
    
    def set_password(self, password):
        """Hash and set password"""
        self.password_hash = generate_password_hash(password)
    
    def check_password(self, password):
        """Check password against hash"""
        return check_password_hash(self.password_hash, password) if self.password_hash else False

    def _safe_json_list(self, raw):
        if not raw:
            return []
        try:
            value = json.loads(raw)
            if isinstance(value, list):
                # keep only strings
                return [str(x) for x in value if isinstance(x, (str, int, float)) and str(x).strip()]
        except Exception:
            return []
        return []

    def get_invitee_names(self):
        # Default to primary name for backward compatibility
        names = self._safe_json_list(self.invitee_names)
        if names:
            return names
        primary = f"{self.first_name} {self.last_name}".strip()
        return [primary] if primary else []

    def get_attending_names(self):
        return self._safe_json_list(self.attending_names)
    
    def to_dict(self, include_sensitive=False):
        """Convert guest to dictionary"""
        result = {
            'id': self.id,
            'first_name': self.first_name,
            'last_name': self.last_name,
            'email': self.email,
            'phone': self.phone,
            'unique_token': self.unique_token if include_sensitive else None,
            'username': self.username if include_sensitive else None,
            'rsvp_status': self.rsvp_status,
            'overnight_stay': self.overnight_stay,
            'number_of_guests': self.number_of_guests,
            'invitee_names': self.get_invitee_names(),
            'attending_names': self.get_attending_names(),
            'dietary_restrictions': self.dietary_restrictions,
            'allergies': self.allergies,
            'special_requests': self.special_requests,
            'music_wish': self.music_wish,
            'address': self.address,
            'notes': self.notes,
            'language': self.language,
            'registered_at': self.registered_at.isoformat() if self.registered_at else None,
            'updated_at': self.updated_at.isoformat() if self.updated_at else None,
            'last_accessed': self.last_accessed.isoformat() if self.last_accessed else None
        }
        return result

