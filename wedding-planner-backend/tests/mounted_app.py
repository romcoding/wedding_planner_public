"""Harness: the REAL ``main.app`` over an in-memory sqlite "D1".

Other test modules stub ``auth`` / ``middleware`` / ``services`` in
``sys.modules`` at import time. ``load_real_app`` purges those stubs, imports
the genuine modules (real routers, real prefixes, real auth, real error
handlers) and restores ``sys.modules`` afterwards, so it neither depends on nor
disturbs the rest of the suite.
"""
import importlib
import os
import sqlite3
import sys
import types
import uuid
from contextlib import contextmanager

_SRC = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "src"))
_SCHEMA = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "schema.sql"))
_OURS = ("auth", "middleware", "entitlements", "db", "errors", "public_cors", "main",
         "obs", "cors_config", "routes", "services")


def _is_ours(name: str) -> bool:
    return any(name == p or name.startswith(p + ".") for p in _OURS)


@contextmanager
def load_real_app():
    saved = {k: v for k, v in sys.modules.items() if _is_ours(k)}
    for k in list(saved):
        del sys.modules[k]
    added_stubs = []
    for n in ("workers", "asgi", "js"):
        if n not in sys.modules:
            sys.modules[n] = types.ModuleType(n)
            added_stubs.append(n)
    # main.py only needs the WorkerEntrypoint base class at import time.
    workers = sys.modules["workers"]
    if not hasattr(workers, "WorkerEntrypoint"):
        workers.WorkerEntrypoint = type("WorkerEntrypoint", (), {})
    os.environ.setdefault("JWT_SECRET_KEY", "test-secret")
    if _SRC not in sys.path:
        sys.path.insert(0, _SRC)
    try:
        main = importlib.import_module("main")
        yield main.app
    finally:
        for k in [k for k in sys.modules if _is_ours(k)]:
            del sys.modules[k]
        sys.modules.update(saved)


# --------------------------------------------------------------------- D1 shim
class _Result:
    def __init__(self, rows):
        self.results = rows


class _Stmt:
    def __init__(self, conn, sql):
        self.conn, self.sql, self.args = conn, sql, ()

    def bind(self, *args):
        self.args = args
        return self

    def _exec(self):
        return self.conn.execute(self.sql, self.args)

    async def first(self):
        row = self._exec().fetchone()
        return dict(row) if row else None

    async def all(self):
        return _Result([dict(r) for r in self._exec().fetchall()])

    async def run(self):
        cur = self._exec()
        self.conn.commit()
        return {"success": True, "meta": {"changes": cur.rowcount}}


class FakeD1:
    """The slice of the D1 API the routes use, backed by sqlite3."""

    def __init__(self):
        self.conn = sqlite3.connect(":memory:", check_same_thread=False)
        self.conn.row_factory = sqlite3.Row
        with open(_SCHEMA) as f:
            self.conn.executescript(f.read())

    def prepare(self, sql):
        return _Stmt(self.conn, sql)

    async def batch(self, stmts):
        try:
            for s in stmts:
                s._exec()
            self.conn.commit()
        except Exception:
            self.conn.rollback()
            raise

    # test conveniences
    def execute(self, sql, *args):
        cur = self.conn.execute(sql, args)
        self.conn.commit()
        return cur

    def rows(self, sql, *args):
        return [dict(r) for r in self.conn.execute(sql, args).fetchall()]


class _Env:
    def __init__(self, db):
        self.DB = db  # no RATE_LIMIT binding: rate limiter fails open


def with_env(app, db):
    """ASGI wrapper that injects the Worker ``env`` the routes read from scope."""
    env = _Env(db)

    async def wrapped(scope, receive, send):
        if scope["type"] in ("http", "websocket"):
            scope["env"] = env
        await app(scope, receive, send)

    return wrapped


# ------------------------------------------------------------------ seed data
def seed_wedding(db, *, email, plan="free", wedding_date=None, verified=1, name="Test"):
    """Insert a user + owned wedding; return (user_id, wedding_id, bearer_headers)."""
    import auth  # the real one (we are inside load_real_app)
    uid, wid = str(uuid.uuid4()), str(uuid.uuid4())
    db.execute(
        "INSERT INTO users (id, email, password_hash, name, role, is_active, email_verified, "
        "current_wedding_id) VALUES (?, ?, 'x', ?, 'admin', 1, ?, ?)",
        uid, email, name, verified, wid,
    )
    db.execute(
        "INSERT INTO weddings (id, slug, owner_id, partner_one_name, partner_two_name, "
        "wedding_date, plan, is_active) VALUES (?, ?, ?, 'A', 'B', ?, ?, 1)",
        wid, f"w-{wid[:8]}", uid, wedding_date, plan,
    )
    token = auth.create_token(uid, wid, "admin")
    return uid, wid, {"Authorization": f"Bearer {token}"}
