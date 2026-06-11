"""Pytest harness for the FastAPI + Cloudflare Workers (Pyodide) backend.

The Workers runtime injects ``workers`` / ``asgi`` / ``js`` modules that do not
exist off-platform, and route handlers are imported with ``src/`` on the path
(e.g. ``from middleware import ...``). This conftest sets both up so unit tests
can import and call handlers directly without a Workers runtime.

Individual test modules may additionally stub ``auth`` to avoid importing the
environment's native ``jwt``/``cryptography`` bindings.
"""
import os
import sys
import types

# Make ``src/`` importable as a top-level package root (matches the Worker).
_SRC = os.path.abspath(os.path.join(os.path.dirname(__file__), "src"))
if _SRC not in sys.path:
    sys.path.insert(0, _SRC)

# Stub the Pyodide/Workers-only modules so imports resolve off-platform.
for _name in ("workers", "asgi", "js"):
    if _name not in sys.modules:
        sys.modules[_name] = types.ModuleType(_name)

# A signing secret must exist for any test that imports the real ``auth``.
os.environ.setdefault("JWT_SECRET_KEY", "test-secret")
