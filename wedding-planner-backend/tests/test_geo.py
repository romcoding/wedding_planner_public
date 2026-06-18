"""Geo → presentment currency (Bug 2).

country_to_currency mapping + the GET /api/geo handler (header-driven, since the
Pyodide ASGI bridge may not expose the cf object).
"""
import os
import sys
import types
import asyncio

os.environ.setdefault("JWT_SECRET_KEY", "test-secret")

for _n in ("workers", "asgi", "js"):
    sys.modules.setdefault(_n, types.ModuleType(_n))

_SRC = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "src"))
if _SRC not in sys.path:
    sys.path.insert(0, _SRC)

from routes import geo_routes  # noqa: E402


def run(coro):
    return asyncio.get_event_loop().run_until_complete(coro)


def _req(headers=None, cf=None):
    req = types.SimpleNamespace()
    hdrs = {k.lower(): v for k, v in (headers or {}).items()}
    req.headers = types.SimpleNamespace(get=lambda k, d=None: hdrs.get(k.lower(), d))
    req.scope = {"cf": cf} if cf is not None else {}
    return req


def test_country_to_currency_mapping():
    assert geo_routes.country_to_currency("CH") == "CHF"
    assert geo_routes.country_to_currency("LI") == "CHF"
    assert geo_routes.country_to_currency("DE") == "EUR"
    assert geo_routes.country_to_currency("FR") == "EUR"
    assert geo_routes.country_to_currency("US") == "USD"
    assert geo_routes.country_to_currency("GB") == "USD"   # non-EU → USD
    assert geo_routes.country_to_currency("br") == "USD"   # case-insensitive


def test_country_to_currency_unknown_defaults_chf():
    assert geo_routes.country_to_currency("") == "CHF"
    assert geo_routes.country_to_currency(None) == "CHF"
    assert geo_routes.country_to_currency("XX") == "CHF"


def test_geo_reads_cf_ipcountry_header():
    assert run(geo_routes.geo(_req(headers={"CF-IPCountry": "DE"}))) == {"country": "DE", "currency": "EUR"}
    assert run(geo_routes.geo(_req(headers={"CF-IPCountry": "CH"}))) == {"country": "CH", "currency": "CHF"}
    assert run(geo_routes.geo(_req(headers={"CF-IPCountry": "US"}))) == {"country": "US", "currency": "USD"}


def test_geo_prefers_cf_object_when_present():
    out = run(geo_routes.geo(_req(headers={"CF-IPCountry": "US"}, cf={"country": "IT"})))
    assert out == {"country": "IT", "currency": "EUR"}


def test_geo_unknown_country_defaults_chf():
    assert run(geo_routes.geo(_req())) == {"country": None, "currency": "CHF"}
    assert run(geo_routes.geo(_req(headers={"CF-IPCountry": "XX"}))) == {"country": None, "currency": "CHF"}
