"""Structured JSON logs for the Workers console (``wrangler tail``).

One compact JSON object per line, written to stdout — which the Cloudflare
Python Workers runtime surfaces as a console log — so operators can filter by the
``event`` key (e.g. ``wrangler tail --format json | jq 'select(.event=="…")'``).

HARD RULE: only ever pass ids, types, counts, statuses, and short slugs. NEVER
pass prompt text, couple PII (names, emails, free-text fields), or secrets. The
helper logs exactly the fields it is given, so safety is the caller's discipline;
``None`` values are dropped to keep lines tidy.
"""
from __future__ import annotations

import json
import sys


def format_event(event: str, **fields) -> str:
    """Return the compact JSON line for *event* (pure; used by log_event + tests)."""
    record = {"event": event}
    for key, value in fields.items():
        if value is not None:
            record[key] = value
    try:
        return json.dumps(record, separators=(",", ":"), default=str, ensure_ascii=False)
    except Exception:
        return json.dumps({"event": event, "log_error": "unserializable"})


def log_event(event: str, **fields) -> None:
    """Emit one structured line to the Workers console."""
    try:
        print(format_event(event, **fields), file=sys.stdout, flush=True)
    except Exception:
        # Logging must never break a request.
        pass
