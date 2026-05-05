from models import db
from datetime import datetime

class InvitationTemplate(db.Model):
    """Template model for invitation emails"""
    __tablename__ = 'invitation_templates'
    
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)
    
    name = db.Column(db.String(200), nullable=False)
    subject = db.Column(db.String(500), nullable=False)
    html_content = db.Column(db.Text, nullable=False)
    
    is_default = db.Column(db.Boolean, default=False)
    is_active = db.Column(db.Boolean, default=True)
    
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    user = db.relationship('User', backref=db.backref('invitation_templates', lazy=True))
    
    def to_dict(self):
        """Convert template to dictionary"""
        return {
            'id': self.id,
            'user_id': self.user_id,
            'name': self.name,
            'subject': self.subject,
            'html_content': self.html_content,
            'is_default': self.is_default,
            'is_active': self.is_active,
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'updated_at': self.updated_at.isoformat() if self.updated_at else None,
        }
