"""Visitor geo → presentment currency.

GET /api/geo returns ``{"country", "currency"}`` so the frontend can present
prices in the visitor's currency (and check out with the matching Stripe price
id). Currency rule: CH/LI → CHF, EU member state → EUR, everything else → USD.
Unknown/anonymized country falls back to CHF (the product's home currency).

Cloudflare attaches the visitor country to every request. We read it from the
``cf`` object when the Pyodide ASGI bridge exposes it, otherwise from the
``CF-IPCountry`` request header (set by Cloudflare on every request) — the same
header-first pattern the rest of the codebase uses for CF-provided values.
"""
from fastapi import APIRouter, Request

router = APIRouter()

# EU member states (ISO-3166-1 alpha-2). CH/LI bill in CHF; the rest of the
# world bills in USD.
_EU_COUNTRIES = frozenset({
    "AT", "BE", "BG", "HR", "CY", "CZ", "DK", "EE", "FI", "FR", "DE", "GR",
    "HU", "IE", "IT", "LV", "LT", "LU", "MT", "NL", "PL", "PT", "RO", "SK",
    "SI", "ES", "SE",
})

# Cloudflare placeholders for unknown / anonymized clients.
_UNKNOWN_COUNTRIES = frozenset({"", "XX", "T1"})

DEFAULT_CURRENCY = "CHF"


def country_to_currency(country: str | None) -> str:
    """Map an ISO country code to a presentment currency (CHF | EUR | USD)."""
    code = (country or "").strip().upper()
    if code in _UNKNOWN_COUNTRIES:
        return DEFAULT_CURRENCY
    if code in ("CH", "LI"):
        return "CHF"
    if code in _EU_COUNTRIES:
        return "EUR"
    return "USD"


def _country_from_request(request: Request) -> str:
    """Best-effort visitor country: cf object if exposed, else CF-IPCountry."""
    try:
        scope = getattr(request, "scope", None) or {}
        cf = scope.get("cf") if hasattr(scope, "get") else None
        if cf:
            country = cf.get("country") if isinstance(cf, dict) else getattr(cf, "country", None)
            if country:
                return str(country)
    except Exception:
        pass
    try:
        return request.headers.get("CF-IPCountry") or request.headers.get("cf-ipcountry") or ""
    except Exception:
        return ""


@router.get("")
async def geo(request: Request):
    """Return the visitor country (or None) and the presentment currency."""
    country = (_country_from_request(request) or "").strip().upper()
    if country in _UNKNOWN_COUNTRIES:
        return {"country": None, "currency": DEFAULT_CURRENCY}
    return {"country": country, "currency": country_to_currency(country)}
