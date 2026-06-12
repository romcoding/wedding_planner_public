"""Durable rate limiting backed by Cloudflare KV.

The previous in-process ``dict`` limiter (auth_routes._rate_buckets) was a no-op
on Workers: isolates are ephemeral and numerous, so per-isolate counters never
shared state and were trivially bypassable. This limiter stores TTL'd counters
in a KV namespace (binding ``RATE_LIMIT``) so windows are shared across isolates
and survive isolate recycling.

KV has no atomic increment and is eventually consistent, so this is best-effort
(it can slightly under-count under heavy concurrency) — which is the right
trade-off for abuse mitigation. If the KV binding is missing or errors, we fail
OPEN (allow) and log, so a misconfiguration never locks out legitimate users.
"""
import logging

logger = logging.getLogger(__name__)

_PREFIX = "rl:"


def _kv(env):
    """Return the RATE_LIMIT KV namespace from the Worker env, or None."""
    if env is None:
        return None
    return getattr(env, "RATE_LIMIT", None)


def _ttl_options(ttl_seconds: int):
    """Build the KV put options object ({expirationTtl}) for this runtime."""
    try:  # Cloudflare Pyodide runtime
        from pyodide.ffi import to_js
        from js import Object
        return to_js({"expirationTtl": ttl_seconds}, dict_converter=Object.fromEntries)
    except Exception:  # off-platform (tests) — a plain dict is fine for fakes
        return {"expirationTtl": ttl_seconds}


async def check(env, key: str, limit: int, window_seconds: int) -> bool:
    """Return True if *key* is within *limit* for the rolling *window_seconds*.

    Increments the counter on each allowed call. Returns False once the limit
    is reached. Fails open (returns True) if KV is unavailable.
    """
    kv = _kv(env)
    if kv is None:
        logger.warning("rate_limit: RATE_LIMIT KV binding missing; allowing request")
        return True

    namespaced = f"{_PREFIX}{key}"
    try:
        raw = await kv.get(namespaced)
        count = int(raw) if raw else 0
        if count >= limit:
            return False
        await kv.put(namespaced, str(count + 1), _ttl_options(window_seconds))
        return True
    except Exception as exc:  # never block legitimate traffic on a KV error
        logger.warning(f"rate_limit: KV error ({exc}); allowing request")
        return True
