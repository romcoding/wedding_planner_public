from src.models import db
from datetime import datetime, date


class AIUsage(db.Model):
    """
    Track daily AI feature usage per wedding tenant.
    Used to enforce Starter plan limit of 3 AI calls/day.
    """
    __tablename__ = 'ai_usage'

    id = db.Column(db.Integer, primary_key=True)
    wedding_id = db.Column(db.String(36), db.ForeignKey('weddings.id'), nullable=False, index=True)
    usage_date = db.Column(db.Date, nullable=False, default=date.today, index=True)
    count = db.Column(db.Integer, nullable=False, default=0)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    __table_args__ = (
        db.UniqueConstraint('wedding_id', 'usage_date', name='uq_ai_usage_wedding_date'),
    )

    wedding = db.relationship('Wedding', backref=db.backref('ai_usages', lazy=True))

    @classmethod
    def get_today_count(cls, wedding_id: str) -> int:
        """Return the number of AI calls made today for a wedding."""
        today = date.today()
        record = cls.query.filter_by(wedding_id=wedding_id, usage_date=today).first()
        return record.count if record else 0

    @classmethod
    def increment(cls, wedding_id: str) -> int:
        """Increment today's AI usage count. Returns the new count."""
        today = date.today()
        record = cls.query.filter_by(wedding_id=wedding_id, usage_date=today).first()
        if record:
            record.count += 1
        else:
            record = cls(wedding_id=wedding_id, usage_date=today, count=1)
            db.session.add(record)
        db.session.commit()
        return record.count

    def to_dict(self) -> dict:
        return {
            'wedding_id': self.wedding_id,
            'usage_date': self.usage_date.isoformat(),
            'count': self.count,
        }
