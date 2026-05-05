from models import db
from datetime import datetime


class Moodboard(db.Model):
    """
    Moodboard model storing a serialized canvas state (content_json) for admins.
    """
    __tablename__ = 'moodboards'

    id = db.Column(db.Integer, primary_key=True)
    owner_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False, index=True)

    title = db.Column(db.String(200), nullable=False, default='Main Moodboard')
    content_json = db.Column(db.Text)  # JSON string

    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    owner = db.relationship('User', backref=db.backref('moodboards', lazy=True))

    def to_dict(self, include_content: bool = False):
        result = {
            'id': self.id,
            'owner_id': self.owner_id,
            'title': self.title,
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'updated_at': self.updated_at.isoformat() if self.updated_at else None,
        }
        if include_content:
            result['contentJson'] = self.content_json or None
        return result

