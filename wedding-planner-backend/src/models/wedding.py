import uuid
from src.models import db
from datetime import datetime
import re


def _generate_slug(partner_one: str, partner_two: str, year: int) -> str:
    """Generate a URL-safe slug from couple names and year."""
    def _slugify(name: str) -> str:
        name = name.lower().strip()
        name = re.sub(r'[^a-z0-9\s-]', '', name)
        name = re.sub(r'[\s]+', '-', name)
        return name.strip('-')

    p1 = _slugify(partner_one.split()[0] if partner_one else 'partner1')
    p2 = _slugify(partner_two.split()[0] if partner_two else 'partner2')
    return f"{p1}-and-{p2}-{year}"


class Wedding(db.Model):
    """
    Tenant model — one row per wedding / couple.
    All other models (Guest, Task, Cost, etc.) reference this via wedding_id.
    """
    __tablename__ = 'weddings'

    id = db.Column(db.String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    slug = db.Column(db.String(120), unique=True, nullable=False, index=True)

    # Ownership
    owner_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False, index=True)

    # Plan / billing
    plan = db.Column(db.String(20), nullable=False, default='free')
    # plan values: free | starter | premium
    stripe_customer_id = db.Column(db.String(120), nullable=True, index=True)
    stripe_subscription_id = db.Column(db.String(120), nullable=True)

    # Wedding details
    partner_one_name = db.Column(db.String(120))
    partner_two_name = db.Column(db.String(120))
    wedding_date = db.Column(db.Date, nullable=True)
    location = db.Column(db.String(255), nullable=True)

    # Status
    is_active = db.Column(db.Boolean, default=True, nullable=False)

    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    owner = db.relationship('User', backref=db.backref('owned_weddings', lazy=True))

    # Plan tier ordering used by plan_required checks
    PLAN_ORDER = {'free': 0, 'starter': 1, 'premium': 2}

    # Feature limits per plan
    PLAN_LIMITS = {
        'free': {
            'max_guests': 30,
            'max_tasks': 10,
            'ai_uses_per_day': 0,
            'custom_slug': False,
            'full_budget': False,
        },
        'starter': {
            'max_guests': 150,
            'max_tasks': None,
            'ai_uses_per_day': 3,
            'custom_slug': True,
            'full_budget': True,
        },
        'premium': {
            'max_guests': None,
            'max_tasks': None,
            'ai_uses_per_day': None,
            'custom_slug': True,
            'full_budget': True,
        },
    }

    def meets_plan(self, min_plan: str) -> bool:
        """Return True if this wedding's plan >= min_plan."""
        my_tier = self.PLAN_ORDER.get(self.plan, 0)
        req_tier = self.PLAN_ORDER.get(min_plan, 0)
        return my_tier >= req_tier

    def get_limit(self, feature: str):
        """Return the limit value for a feature on the current plan (None = unlimited)."""
        return self.PLAN_LIMITS.get(self.plan, {}).get(feature)

    def to_dict(self) -> dict:
        return {
            'id': self.id,
            'slug': self.slug,
            'owner_id': self.owner_id,
            'plan': self.plan,
            'partner_one_name': self.partner_one_name,
            'partner_two_name': self.partner_two_name,
            'wedding_date': self.wedding_date.isoformat() if self.wedding_date else None,
            'location': self.location,
            'is_active': self.is_active,
            'stripe_customer_id': self.stripe_customer_id,
            'stripe_subscription_id': self.stripe_subscription_id,
            'limits': self.PLAN_LIMITS.get(self.plan, {}),
            'created_at': self.created_at.isoformat() if self.created_at else None,
        }
