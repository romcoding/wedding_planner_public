from src.models import db
from datetime import datetime
import json

class VenueChatHistory(db.Model):
    """Chat conversation history for venue Q&A"""
    __tablename__ = 'venue_chat_history'
    
    id = db.Column(db.Integer, primary_key=True)
    venue_id = db.Column(db.Integer, db.ForeignKey('venues.id', ondelete='CASCADE'), nullable=False)
    user_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)
    
    # Conversation metadata
    session_id = db.Column(db.String(100))  # Optional: group messages into sessions
    message_type = db.Column(db.String(20), nullable=False)  # 'user' or 'assistant'
    
    # Message content
    message = db.Column(db.Text, nullable=False)  # User question or assistant response
    
    # Citations (for assistant messages)
    citations = db.Column(db.Text)  # JSON array of citation objects: [{"document_id": 1, "chunk_id": 5, "text": "...", "page": 3}]
    
    # Metadata
    tokens_used = db.Column(db.Integer)  # OpenAI tokens used for this response
    model_used = db.Column(db.String(50))  # e.g., 'gpt-4', 'gpt-3.5-turbo'
    
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    
    venue = db.relationship('Venue', backref=db.backref('chat_history', lazy=True, cascade='all, delete-orphan'))
    user = db.relationship('User', backref=db.backref('venue_chats', lazy=True))
    
    def to_dict(self):
        citations_list = []
        if self.citations:
            try:
                citations_list = json.loads(self.citations)
            except (json.JSONDecodeError, TypeError):
                pass
        
        return {
            'id': self.id,
            'venue_id': self.venue_id,
            'user_id': self.user_id,
            'session_id': self.session_id,
            'message_type': self.message_type,
            'message': self.message,
            'citations': citations_list,
            'tokens_used': self.tokens_used,
            'model_used': self.model_used,
            'created_at': self.created_at.isoformat() if self.created_at else None,
        }
