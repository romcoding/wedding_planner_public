"""Wedi website-generation usage ledger — the HARD server-side cost control.

This is the budget enforcement for "Wedi designs your website". It is a SEPARATE
ledger from the legacy ``ai_usage`` / ``token_usage`` daily-cap tables (which back
the older AI endpoints) — the two must never be conflated.

Three things live here:

  * a monthly budget check (``check_budget``) that raises ``BudgetExceeded`` once
    the generation count OR the token total for the current UTC ``YYYY-MM`` period
    meets the plan's entitlement limits — the monthly reset is implicit in the
    period key, so there is no cron,
  * usage recording (``record_usage``) that increments the period counters from
    the ACTUAL token usage reported by the model and writes an audit-log row,
  * the per-minute velocity check and the kill-switch read.

All plan limits come from ``entitlements`` (the single source of truth); nothing
here hardcodes a number. All DB reads normalize rows via ``db.row_to_dict``.
"""
from datetime import datetime, timezone

import entitlements
from db import row_to_dict
from services import rate_limit


class BudgetExceeded(Exception):
    """Raised by ``check_budget`` when the monthly budget is met or exceeded.

    ``reason`` is ``"generations"`` or ``"tokens"``; ``resets_on`` is the ISO date
    (``YYYY-MM-01``) of the next period, surfaced in the user-facing copy.
    """

    def __init__(self, reason: str, resets_on: str):
        super().__init__(reason)
        self.reason = reason
        self.resets_on = resets_on


# ---------------------------------------------------------------------------
# Period helpers — the monthly reset is implicit in this key (no cron).
# ---------------------------------------------------------------------------

def current_period() -> str:
    """Return the current budget period as a UTC ``YYYY-MM`` string."""
    return datetime.now(timezone.utc).strftime("%Y-%m")


def resets_on(period: str | None = None) -> str:
    """Return the ISO date (``YYYY-MM-01``) on which *period*'s budget resets."""
    period = period or current_period()
    year, month = (int(part) for part in period.split("-"))
    if month >= 12:
        year, month = year + 1, 1
    else:
        month += 1
    return f"{year:04d}-{month:02d}-01"


# ---------------------------------------------------------------------------
# Kill switch + per-minute velocity
# ---------------------------------------------------------------------------

def generation_disabled(env) -> bool:
    """True if the operator kill switch (env ``WEDI_GENERATION_DISABLED=="1"``) is on."""
    return getattr(env, "WEDI_GENERATION_DISABLED", None) == "1"


async def within_velocity(env, wedding_id: str) -> bool:
    """Per-account per-minute velocity gate (best-effort, KV-backed; fails open)."""
    return await rate_limit.check(
        env,
        f"wedi:{wedding_id}",
        entitlements.WEDI_REQUESTS_PER_MINUTE,
        60,
    )


# ---------------------------------------------------------------------------
# Budget check / recording / status
# ---------------------------------------------------------------------------

async def _period_usage(db, wedding_id: str, period: str) -> dict:
    raw = await db.prepare(
        "SELECT generations, input_tokens, output_tokens "
        "FROM wedi_site_usage WHERE wedding_id = ? AND period = ?"
    ).bind(wedding_id, period).first()
    row = row_to_dict(raw) or {}
    return {
        "generations": row.get("generations") or 0,
        "input_tokens": row.get("input_tokens") or 0,
        "output_tokens": row.get("output_tokens") or 0,
    }


async def check_budget(db, wedding_id: str, plan: str) -> None:
    """Raise ``BudgetExceeded`` if this period's generation or token budget is met.

    Limits come from ``entitlements`` for *plan*. A ``None`` limit means unlimited
    (not used by Wedi today, but handled defensively). The check is ``>=`` so the
    Nth call is allowed and the (N+1)th is refused.
    """
    gen_limit = entitlements.get_limit(plan, "wedi_generations_per_month")
    tok_limit = entitlements.get_limit(plan, "wedi_tokens_per_month")
    period = current_period()
    usage = await _period_usage(db, wedding_id, period)

    used_tokens = usage["input_tokens"] + usage["output_tokens"]
    when = resets_on(period)
    if gen_limit is not None and usage["generations"] >= gen_limit:
        raise BudgetExceeded("generations", when)
    if tok_limit is not None and used_tokens >= tok_limit:
        raise BudgetExceeded("tokens", when)


async def log_generation(db, wedding_id: str, model, status: str,
                         usage: dict | None = None, purpose: str = "generate") -> None:
    """Append one ``wedi_generation_log`` row. Used for 'ok', 'error', 'over_limit'."""
    usage = usage or {}
    in_tok = int(usage.get("input_tokens") or 0)
    out_tok = int(usage.get("output_tokens") or 0)
    await db.prepare(
        "INSERT INTO wedi_generation_log "
        "(wedding_id, created_at, model, input_tokens, output_tokens, status, purpose) "
        "VALUES (?, datetime('now'), ?, ?, ?, ?, ?)"
    ).bind(wedding_id, model, in_tok, out_tok, status, purpose).run()


async def record_usage(db, wedding_id: str, model, usage: dict,
                       purpose: str = "generate") -> None:
    """Increment the period counters from the model's ACTUAL usage + log an 'ok' row.

    Uses an UPSERT on the ``UNIQUE(wedding_id, period)`` constraint so the first
    generation in a period inserts and subsequent ones increment.
    """
    usage = usage or {}
    in_tok = int(usage.get("input_tokens") or 0)
    out_tok = int(usage.get("output_tokens") or 0)
    period = current_period()
    await db.prepare(
        "INSERT INTO wedi_site_usage "
        "(wedding_id, period, generations, input_tokens, output_tokens) "
        "VALUES (?, ?, 1, ?, ?) "
        "ON CONFLICT(wedding_id, period) DO UPDATE SET "
        "generations = generations + 1, "
        "input_tokens = input_tokens + excluded.input_tokens, "
        "output_tokens = output_tokens + excluded.output_tokens"
    ).bind(wedding_id, period, in_tok, out_tok).run()
    await log_generation(db, wedding_id, model, "ok", usage, purpose)


async def get_status(db, wedding_id: str, plan: str) -> dict:
    """Return ``{used, limit, resetsOn, remaining}`` for the current period."""
    gen_limit = entitlements.get_limit(plan, "wedi_generations_per_month")
    period = current_period()
    usage = await _period_usage(db, wedding_id, period)
    used = usage["generations"]
    if gen_limit is None:
        remaining = None
    else:
        remaining = max(0, gen_limit - used)
    return {
        "used": used,
        "limit": gen_limit,
        "resetsOn": resets_on(period),
        "remaining": remaining,
    }
