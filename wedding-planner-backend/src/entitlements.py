"""Plan entitlements — the single source of truth for features and limits.

Supersedes ``middleware.PLAN_LIMITS`` / ``wedding_meets_plan`` / ``require_plan``.

Plan vocabulary: ``free | premium | lifetime``. Legacy ``starter`` rows are
treated as ``premium`` (see migrations/003_plans.sql). Feature sets are aligned
with the frontend ``lib/planFeatures.js`` FEATURE_MIN_PLAN map, where any
``starter`` minimum is treated as ``premium`` now. The backend is the
enforcement layer; frontend gating is UX only.
"""
import os
from fastapi import Depends, HTTPException

from middleware import get_wedding, _admin_emails

# ---------------------------------------------------------------------------
# Feature sets
# ---------------------------------------------------------------------------

# free: the always-available basics
_FREE_FEATURES = {
    "guests",
    "tasks",
    "costs_basic",
    "agenda_basic",
}

# premium/lifetime: everything
_PREMIUM_FEATURES = _FREE_FEATURES | {
    "invitations",
    "events",
    "moodboard",
    "guest_photos",
    "seating",
    "messages",
    "gift_registry",
    "venue",
    "rsvp_reminders",
    "full_budget",
    "ai",
    "website_builder",
    "wedi_site_generation",
    "public_hosting",
}

# ---------------------------------------------------------------------------
# Plan definitions — features + per-plan limits
# ---------------------------------------------------------------------------

PLANS: dict[str, dict] = {
    "free": {
        "features": _FREE_FEATURES,
        "limits": {
            "max_guests": 30,
            "max_tasks": 10,
            "custom_slug": False,
            "full_budget": False,
            # AI / Wedi
            "ai_uses_per_day": 0,
            "wedi_generations_per_month": 0,
            "wedi_tokens_per_month": 0,
        },
    },
    "premium": {
        "features": _PREMIUM_FEATURES,
        "limits": {
            "max_guests": None,
            "max_tasks": None,
            "custom_slug": True,
            "full_budget": True,
            # AI / Wedi — no daily cap; monthly generation/token caps apply
            "ai_uses_per_day": None,
            "wedi_generations_per_month": 30,
            "wedi_tokens_per_month": 400000,
        },
    },
    "lifetime": {
        "features": _PREMIUM_FEATURES,
        "limits": {
            "max_guests": None,
            "max_tasks": None,
            "custom_slug": True,
            "full_budget": True,
            "ai_uses_per_day": None,
            "wedi_generations_per_month": 30,
            "wedi_tokens_per_month": 400000,
        },
    },
}

# Plan-independent request limits (consumed by Phase 3 abuse hardening).
MAX_OUTPUT_TOKENS_PER_REQUEST = 4000
WEDI_REQUESTS_PER_MINUTE = 5

VALID_PLANS = tuple(PLANS.keys())  # ("free", "premium", "lifetime")


# ---------------------------------------------------------------------------
# Resolution helpers
# ---------------------------------------------------------------------------

def is_admin_email(email: str | None) -> bool:
    """True if *email* is in the ADMIN_EMAILS allow-list."""
    return bool(email and email.lower() in _admin_emails())


def normalize_plan(plan: str | None) -> str:
    """Map a stored plan value onto the current vocabulary (free|premium|lifetime)."""
    if plan == "starter":  # legacy
        return "premium"
    if plan in PLANS:
        return plan
    return "free"


def get_plan(wedding_row: dict, user_email: str | None = None) -> str:
    """Resolve the effective plan for a wedding.

    This is the one resolution function used everywhere. ADMIN_EMAILS users
    resolve to full entitlements (``lifetime``); everyone else gets their
    stored (normalized) plan.
    """
    if is_admin_email(user_email):
        return "lifetime"
    return normalize_plan((wedding_row or {}).get("plan"))


# ---------------------------------------------------------------------------
# Feature / limit lookups
# ---------------------------------------------------------------------------

def plan_features(plan: str) -> set:
    return PLANS.get(normalize_plan(plan), PLANS["free"])["features"]


def plan_has_feature(plan: str, feature: str) -> bool:
    return feature in plan_features(plan)


def wedding_has_feature(wedding: dict, feature: str) -> bool:
    return plan_has_feature(get_plan(wedding), feature)


def get_limits(plan: str) -> dict:
    """Return the full per-plan limits dict (used by /billing/status, etc.)."""
    return dict(PLANS.get(normalize_plan(plan), PLANS["free"])["limits"])


def get_limit(plan: str, key: str):
    """Return a single per-plan limit value (None usually means 'unlimited')."""
    return PLANS.get(normalize_plan(plan), PLANS["free"])["limits"].get(key)


# ---------------------------------------------------------------------------
# FastAPI dependency
# ---------------------------------------------------------------------------

def require_feature(feature: str):
    """Dependency factory: 403 ``upgrade_required`` unless the plan has *feature*.

    Resolves the wedding via ``get_wedding`` (which already applies the
    admin-override), then checks the feature against the resolved plan.
    """
    async def _check(wedding: dict = Depends(get_wedding)) -> dict:
        plan = get_plan(wedding)
        if not plan_has_feature(plan, feature):
            raise HTTPException(
                403,
                detail={"code": "upgrade_required", "feature": feature},
            )
        return wedding
    return _check
