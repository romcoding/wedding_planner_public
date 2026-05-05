from datetime import datetime

from models import db


class UserSubscription(db.Model):
    __tablename__ = 'user_subscriptions'

    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False, index=True, unique=True)
    plan_type = db.Column(db.String(20), nullable=False, default='free')
    balance_tokens = db.Column(db.Integer, nullable=False, default=100)
    is_active = db.Column(db.Boolean, nullable=False, default=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow, nullable=False)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)

    def to_dict(self):
        return {
            'id': self.id,
            'user_id': self.user_id,
            'plan_type': self.plan_type,
            'balance_tokens': self.balance_tokens,
            'is_active': self.is_active,
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'updated_at': self.updated_at.isoformat() if self.updated_at else None,
        }


class TokenUsage(db.Model):
    __tablename__ = 'token_usage'

    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False, index=True)
    feature = db.Column(db.String(64), nullable=False, index=True)
    tokens_consumed = db.Column(db.Integer, nullable=False)
    cost_base = db.Column(db.Float, nullable=False)
    cost_margin = db.Column(db.Float, nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow, nullable=False)

    def to_dict(self):
        return {
            'id': self.id,
            'user_id': self.user_id,
            'feature': self.feature,
            'tokens_consumed': self.tokens_consumed,
            'cost_base': self.cost_base,
            'cost_margin': self.cost_margin,
            'total_cost': (self.cost_base or 0.0) + (self.cost_margin or 0.0),
            'created_at': self.created_at.isoformat() if self.created_at else None,
        }
