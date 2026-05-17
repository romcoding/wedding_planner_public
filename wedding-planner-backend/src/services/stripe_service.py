"""
Thin Stripe HTTP helpers.

The official `stripe` Python SDK isn't Pyodide-compatible, so every Stripe
call goes through httpx using the Stripe REST API. This module centralizes
the form-encoding rules and authentication so route handlers stay small.

All functions raise HTTPException(502) on Stripe-side errors and
HTTPException(503) if STRIPE_SECRET_KEY is missing.
"""

import os
import logging
import urllib.parse
from typing import Any

import httpx
from fastapi import HTTPException

logger = logging.getLogger(__name__)

STRIPE_API_BASE = "https://api.stripe.com/v1"


def _flatten_form(data: Any, prefix: str = "") -> list[tuple[str, str]]:
    """Convert nested dict/list into Stripe-style bracketed form pairs.

    e.g. {"line_items":[{"price":"price_x"}]} → line_items[0][price]=price_x
    """
    out: list[tuple[str, str]] = []
    if isinstance(data, dict):
        for k, v in data.items():
            key = f"{prefix}[{k}]" if prefix else k
            out.extend(_flatten_form(v, key))
    elif isinstance(data, list):
        for i, v in enumerate(data):
            key = f"{prefix}[{i}]"
            out.extend(_flatten_form(v, key))
    elif data is None:
        return out
    elif isinstance(data, bool):
        out.append((prefix, "true" if data else "false"))
    else:
        out.append((prefix, str(data)))
    return out


def _resolve_secret(env=None) -> str:
    """Read STRIPE_SECRET_KEY from the worker env binding or process env."""
    if env is not None:
        secret = getattr(env, "STRIPE_SECRET_KEY", None)
        if secret:
            return str(secret)
    return os.environ.get("STRIPE_SECRET_KEY", "")


async def _stripe_post(path: str, form: dict, env=None) -> dict:
    """POST application/x-www-form-urlencoded to the Stripe API."""
    secret = _resolve_secret(env)
    if not secret:
        raise HTTPException(503, "Stripe is not configured on this server")

    payload = urllib.parse.urlencode(_flatten_form(form), doseq=True)
    async with httpx.AsyncClient(timeout=20.0) as client:
        resp = await client.post(
            f"{STRIPE_API_BASE}{path}",
            content=payload,
            headers={
                "Authorization": f"Bearer {secret}",
                "Content-Type": "application/x-www-form-urlencoded",
            },
        )
    if resp.status_code >= 400:
        try:
            err = resp.json().get("error", {})
            msg = err.get("message") or err.get("type") or resp.text
        except Exception:
            msg = resp.text
        logger.error(f"Stripe API {path} failed: {resp.status_code} {msg}")
        raise HTTPException(502, f"Stripe API error: {msg}")
    return resp.json()


async def create_customer(env, email: str, name: str, metadata: dict | None = None) -> str:
    """Creates a Stripe customer and returns customer_id."""
    body: dict[str, Any] = {"email": email or "", "name": name or ""}
    if metadata:
        body["metadata"] = metadata
    customer = await _stripe_post("/customers", body, env=env)
    return customer["id"]


async def create_checkout_session(
    env,
    customer_id: str,
    price_id: str,
    wedding_id: str,
    success_url: str,
    cancel_url: str,
    mode: str,
) -> str:
    """Returns checkout session URL."""
    if mode not in ("subscription", "payment"):
        raise HTTPException(400, 'mode must be "subscription" or "payment"')

    session_form: dict[str, Any] = {
        "customer": customer_id,
        "mode": mode,
        "line_items": [{"price": price_id, "quantity": 1}],
        "success_url": success_url,
        "cancel_url": cancel_url,
        "client_reference_id": wedding_id,
        "metadata": {"wedding_id": wedding_id},
    }
    if mode == "subscription":
        session_form["subscription_data"] = {"metadata": {"wedding_id": wedding_id}}
    else:
        session_form["payment_intent_data"] = {"metadata": {"wedding_id": wedding_id}}

    session = await _stripe_post("/checkout/sessions", session_form, env=env)
    return session.get("url", "")
