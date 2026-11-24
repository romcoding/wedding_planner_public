import pytest
from fastapi.testclient import TestClient

from tests.mounted_app import FakeD1, load_real_app, seed_wedding, with_env


@pytest.fixture(scope="module")
def real_app():
    """The genuine ``main.app`` (see tests/mounted_app.py), one per test module."""
    with load_real_app() as app:
        yield app


class World:
    """A fresh in-memory D1 + TestClient over the real app, with seeding helpers."""

    def __init__(self, app):
        self.db = FakeD1()
        self.client = TestClient(with_env(app, self.db))

    def wedding(self, email, **kw):
        uid, wid, headers = seed_wedding(self.db, email=email, **kw)
        return type("W", (), {"user_id": uid, "id": wid, "h": headers})


@pytest.fixture()
def world(real_app):
    return World(real_app)
