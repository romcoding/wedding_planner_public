"""Pytest configuration and fixtures for wedding planner backend tests."""
import os
import pytest
from src.main import create_app
from src.models import db, Guest, User, Message


@pytest.fixture
def app():
    """Create application for testing with in-memory SQLite."""
    os.environ['DATABASE_URL'] = 'sqlite:///:memory:'
    app = create_app()
    app.config['TESTING'] = True
    app.config['JWT_SECRET_KEY'] = 'test-jwt-secret'
    app.config['SECRET_KEY'] = 'test-secret'
    return app


@pytest.fixture
def client(app):
    """Create test client."""
    return app.test_client()


@pytest.fixture
def app_context(app):
    """Application context for tests."""
    with app.app_context():
        yield


@pytest.fixture
def init_db(app, app_context):
    """Initialize database and create tables."""
    db.create_all()
    yield
    db.drop_all()


@pytest.fixture
def guest(init_db):
    """Create a test guest and return (guest, token)."""
    g = Guest(
        first_name='Test',
        last_name='Guest',
        email='test@example.com',
        username='testguest',
        unique_token=Guest.generate_unique_token(),
    )
    g.set_password('testpass')
    db.session.add(g)
    db.session.commit()
    from flask_jwt_extended import create_access_token
    token = create_access_token(identity=f"guest_{g.id}")
    return {'guest': g, 'token': token}


@pytest.fixture
def admin_user(init_db):
    """Create a test admin user."""
    u = User(
        email='admin@test.com',
        name='Admin User',
        role='admin',
    )
    u.set_password('adminpass')
    db.session.add(u)
    db.session.commit()
    return u
