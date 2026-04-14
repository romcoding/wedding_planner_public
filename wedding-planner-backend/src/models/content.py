from src.models import db
from datetime import datetime

class Content(db.Model):
    """Content model for managing wedding information displayed to guests"""
    __tablename__ = 'content'
    
    id = db.Column(db.Integer, primary_key=True)
    # Multi-tenant FK (nullable so existing single-tenant content still works)
    wedding_id = db.Column(db.String(36), db.ForeignKey('weddings.id'), nullable=True, index=True)
    key = db.Column(db.String(100), nullable=False, index=True)  # e.g., 'welcome_message', 'venue_info'
    title = db.Column(db.String(200))
    content = db.Column(db.Text, nullable=False)  # Legacy field, kept for backward compatibility
    # Multilingual content
    content_en = db.Column(db.Text)  # English content
    content_de = db.Column(db.Text)  # German content
    content_fr = db.Column(db.Text)  # French content
    content_type = db.Column(db.String(50), default='text')  # text, html, markdown
    is_public = db.Column(db.Boolean, default=True)  # Visible to guests
    order = db.Column(db.Integer, default=0)  # For ordering on public page
    
    # Scheduling
    published_at = db.Column(db.DateTime)  # When content was published
    scheduled_publish_at = db.Column(db.DateTime)  # Schedule content to be published at this time
    scheduled_unpublish_at = db.Column(db.DateTime)  # Schedule content to be unpublished at this time
    
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    def to_dict(self, language='en'):
        """Convert content to dictionary"""
        # Get content for specified language, fallback to legacy content or English
        content_text = None
        if language == 'en':
            content_text = self.content_en or self.content
        elif language == 'de':
            content_text = self.content_de
        elif language == 'fr':
            content_text = self.content_fr
        
        # Fallback chain: specified language -> English -> legacy content
        if not content_text:
            content_text = self.content_en or self.content
        
        return {
            'id': self.id,
            'key': self.key,
            'title': self.title,
            'content': content_text,
            'content_en': self.content_en or self.content,
            'content_de': self.content_de,
            'content_fr': self.content_fr,
            'content_type': self.content_type,
            'is_public': self.is_public,
            'order': self.order,
            'published_at': self.published_at.isoformat() if self.published_at else None,
            'scheduled_publish_at': self.scheduled_publish_at.isoformat() if self.scheduled_publish_at else None,
            'scheduled_unpublish_at': self.scheduled_unpublish_at.isoformat() if self.scheduled_unpublish_at else None,
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'updated_at': self.updated_at.isoformat() if self.updated_at else None
        }

