"""Health endpoint + app-wiring smoke test (Phase 4 #12).

Importing the real ``main.app`` also proves the whole router + middleware stack
(consolidated errors, public-RSVP CORS) wires without import errors — a useful
pre-launch guard. GET /api/health reports the GIT_SHA injected at deploy time.
"""
import os
import sys
import types

os.environ.setdefault("JWT_SECRET_KEY", "test-secret")
os.environ["GIT_SHA"] = "abc1234deadbeef"

# Workers/Pyodide runtime stubs. WorkerEntrypoint must be subclassable for the
# `class Default(WorkerEntrypoint)` in main.py to import off-platform.
_workers = types.ModuleType("workers")
_workers.WorkerEntrypoint = object
sys.modules["workers"] = _workers
sys.modules.setdefault("asgi", types.ModuleType("asgi"))

# Stub `auth` so the env's native jwt/cryptography is never imported.
_auth = types.ModuleType("auth")
async def _require_couple_auth(request=None):
    return {"sub": "user"}
_auth.require_couple_auth = _require_couple_auth
_auth.require_admin_auth = _require_couple_auth
_auth.decode_token = lambda t: {}
_auth.create_token = lambda *a, **k: "t"
_auth.create_guest_token = lambda *a, **k: "g"
sys.modules["auth"] = _auth

_SRC = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "src"))
if _SRC not in sys.path:
    sys.path.insert(0, _SRC)

# Force the real middleware/entitlements/db (a sibling test may have stubbed them).
for _m in ("middleware", "entitlements", "db"):
    _mod = sys.modules.get(_m)
    if _mod is not None and getattr(_mod, "__file__", None) is None:
        del sys.modules[_m]

_services_pkg = sys.modules.get("services")
if _services_pkg is not None and not hasattr(_services_pkg, "__path__"):
    _services_pkg.__path__ = [os.path.join(_SRC, "services")]

import main  # noqa: E402  (imports the full app — a wiring smoke test in itself)
from fastapi.testclient import TestClient  # noqa: E402

_client = TestClient(main.app)


def test_health_reports_status_ok_and_version():
    r = _client.get("/api/health")
    assert r.status_code == 200
    assert r.json() == {"status": "ok", "version": "abc1234deadbeef"}
