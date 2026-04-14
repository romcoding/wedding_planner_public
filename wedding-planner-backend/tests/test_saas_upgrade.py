"""
Tests for Pillar 1 (multi-tenant), Pillar 2 (Stripe webhook), and Pillar 3 (AI limiter).
"""
import json
import pytest
import uuid
from unittest.mock import patch, MagicMock
from datetime import date

from src.main import create_app
from src.models import db, User
from src.models.wedding import Wedding
from src.models.ai_usage import AIUsage


# ─── Fixtures ─────────────────────────────────────────────────────────────────

@pytest.fixture
def app():
    import os
    os.environ['DATABASE_URL'] = 'sqlite:///:memory:'
    os.environ['STRIPE_WEBHOOK_SECRET'] = 'test_webhook_secret'
    os.environ['STRIPE_SECRET_KEY'] = 'sk_test_fake'
    os.environ['STRIPE_STARTER_PRICE_ID'] = 'price_starter_fake'
    os.environ['STRIPE_PREMIUM_PRICE_ID'] = 'price_premium_fake'
    app = create_app()
    app.config['TESTING'] = True
    app.config['JWT_SECRET_KEY'] = 'test-jwt-secret'
    return app


@pytest.fixture
def client(app):
    return app.test_client()


@pytest.fixture
def db_session(app):
    with app.app_context():
        db.create_all()
        yield db
        db.drop_all()


def _make_user_and_token(app, db_session, role='admin'):
    """Helper: create a user, return (user, JWT header dict)."""
    from flask_jwt_extended import create_access_token
    user = User(
        email=f'user_{uuid.uuid4().hex[:6]}@test.com',
        name='Test User',
        role=role,
    )
    user.set_password('password')
    db_session.session.add(user)
    db_session.session.commit()
    with app.app_context():
        token = create_access_token(identity=str(user.id))
    return user, {'Authorization': f'Bearer {token}'}


def _make_wedding(db_session, owner_id, plan='free', slug=None):
    """Helper: create a Wedding tenant row."""
    w = Wedding(
        id=str(uuid.uuid4()),
        slug=slug or f'test-wedding-{uuid.uuid4().hex[:6]}',
        owner_id=owner_id,
        plan=plan,
        is_active=True,
    )
    db_session.session.add(w)
    db_session.session.commit()
    return w


# ─── Pillar 1: Tenant Isolation ───────────────────────────────────────────────

class TestTenantIsolation:
    def test_create_wedding(self, app, client, db_session):
        user, headers = _make_user_and_token(app, db_session)
        payload = {
            'partner_one_name': 'Alice',
            'partner_two_name': 'Bob',
            'wedding_date': '2027-06-15',
            'location': 'Paris',
        }
        res = client.post('/api/weddings/create', json=payload, headers=headers)
        assert res.status_code == 201
        data = res.get_json()
        assert data['wedding']['partner_one_name'] == 'Alice'
        assert data['wedding']['slug'].startswith('alice-and-bob')

    def test_cannot_create_duplicate_wedding(self, app, client, db_session):
        user, headers = _make_user_and_token(app, db_session)
        _make_wedding(db_session, user.id)
        # Set current_wedding_id so it's recognized
        user.current_wedding_id = db_session.session.query(Wedding).filter_by(owner_id=user.id).first().id
        db_session.session.commit()

        payload = {'partner_one_name': 'Alice', 'partner_two_name': 'Bob'}
        res = client.post('/api/weddings/create', json=payload, headers=headers)
        assert res.status_code == 409

    def test_get_current_wedding(self, app, client, db_session):
        user, headers = _make_user_and_token(app, db_session)
        w = _make_wedding(db_session, user.id, slug='my-test-wedding')
        user.current_wedding_id = w.id
        db_session.session.commit()

        res = client.get('/api/weddings/current', headers=headers)
        assert res.status_code == 200
        assert res.get_json()['slug'] == 'my-test-wedding'

    def test_no_wedding_returns_needs_onboarding(self, app, client, db_session):
        user, headers = _make_user_and_token(app, db_session)
        res = client.get('/api/weddings/current', headers=headers)
        assert res.status_code == 403
        assert res.get_json().get('needs_onboarding') is True

    def test_get_wedding_by_slug_public(self, app, client, db_session):
        user, _ = _make_user_and_token(app, db_session)
        w = _make_wedding(db_session, user.id, slug='public-test-2027')
        res = client.get('/api/weddings/by-slug/public-test-2027')
        assert res.status_code == 200
        assert res.get_json()['slug'] == 'public-test-2027'

    def test_slug_not_found(self, app, client, db_session):
        res = client.get('/api/weddings/by-slug/does-not-exist')
        assert res.status_code == 404

    def test_tenant_required_without_jwt(self, app, client, db_session):
        res = client.get('/api/weddings/current')
        assert res.status_code == 401

    def test_slugs_are_unique(self, app, client, db_session):
        """Two weddings with same base data should get different slugs."""
        user1, h1 = _make_user_and_token(app, db_session)
        user2, h2 = _make_user_and_token(app, db_session)
        payload = {'partner_one_name': 'Sam', 'partner_two_name': 'Jo', 'wedding_date': '2027-01-01'}
        res1 = client.post('/api/weddings/create', json=payload, headers=h1)
        res2 = client.post('/api/weddings/create', json=payload, headers=h2)
        assert res1.status_code == 201
        assert res2.status_code == 201
        slug1 = res1.get_json()['wedding']['slug']
        slug2 = res2.get_json()['wedding']['slug']
        assert slug1 != slug2


# ─── Pillar 2: Stripe Webhook ─────────────────────────────────────────────────

class TestStripeWebhook:
    def _make_event(self, event_type, obj):
        return {
            'type': event_type,
            'data': {'object': obj},
        }

    @patch('stripe.Webhook.construct_event')
    def test_checkout_completed_upgrades_plan(self, mock_construct, app, client, db_session):
        user, _ = _make_user_and_token(app, db_session)
        w = _make_wedding(db_session, user.id)
        assert w.plan == 'free'

        event = self._make_event('checkout.session.completed', {
            'metadata': {'wedding_id': w.id, 'plan': 'starter'},
            'subscription': 'sub_test123',
        })
        mock_construct.return_value = event

        res = client.post(
            '/api/billing/webhook',
            data=json.dumps(event),
            content_type='application/json',
            headers={'Stripe-Signature': 'test_sig'},
        )
        assert res.status_code == 200

        with app.app_context():
            updated = db_session.session.get(Wedding, w.id)
            assert updated.plan == 'starter'
            assert updated.stripe_subscription_id == 'sub_test123'

    @patch('stripe.Webhook.construct_event')
    def test_subscription_deleted_downgrades_to_free(self, mock_construct, app, client, db_session):
        user, _ = _make_user_and_token(app, db_session)
        w = _make_wedding(db_session, user.id, plan='premium')
        w.stripe_subscription_id = 'sub_delete_me'
        db_session.session.commit()

        event = self._make_event('customer.subscription.deleted', {
            'id': 'sub_delete_me',
            'metadata': {'wedding_id': w.id},
        })
        mock_construct.return_value = event

        res = client.post(
            '/api/billing/webhook',
            data=json.dumps(event),
            content_type='application/json',
            headers={'Stripe-Signature': 'test_sig'},
        )
        assert res.status_code == 200

        with app.app_context():
            updated = db_session.session.get(Wedding, w.id)
            assert updated.plan == 'free'

    @patch('stripe.Webhook.construct_event')
    def test_invalid_signature_rejected(self, mock_construct, app, client, db_session):
        import stripe
        mock_construct.side_effect = stripe.error.SignatureVerificationError('bad sig', 'header')
        res = client.post(
            '/api/billing/webhook',
            data='{}',
            content_type='application/json',
            headers={'Stripe-Signature': 'bad'},
        )
        assert res.status_code == 400


# ─── Pillar 3: AI Usage Limiter ───────────────────────────────────────────────

class TestAIUsageLimiter:
    def test_get_usage_count(self, app, db_session):
        user, _ = _make_user_and_token(app, db_session)
        w = _make_wedding(db_session, user.id, plan='starter')
        with app.app_context():
            count = AIUsage.get_today_count(w.id)
            assert count == 0

    def test_increment_usage(self, app, db_session):
        user, _ = _make_user_and_token(app, db_session)
        w = _make_wedding(db_session, user.id, plan='starter')
        with app.app_context():
            new_count = AIUsage.increment(w.id)
            assert new_count == 1
            new_count2 = AIUsage.increment(w.id)
            assert new_count2 == 2

    def test_daily_reset(self, app, db_session):
        """Usage on different dates should not accumulate."""
        from datetime import date as real_date
        user, _ = _make_user_and_token(app, db_session)
        w = _make_wedding(db_session, user.id, plan='starter')
        with app.app_context():
            # Simulate yesterday's usage
            yesterday = AIUsage(
                wedding_id=w.id,
                usage_date=real_date(2020, 1, 1),
                count=3,
            )
            db_session.session.add(yesterday)
            db_session.session.commit()

            # Today's count should be 0
            today_count = AIUsage.get_today_count(w.id)
            assert today_count == 0

    def test_free_plan_blocked_from_ai(self, app, client, db_session):
        user, headers = _make_user_and_token(app, db_session)
        w = _make_wedding(db_session, user.id, plan='free')
        user.current_wedding_id = w.id
        db_session.session.commit()

        res = client.post('/api/ai/timeline', json={
            'wedding_date': '2027-01-01',
            'location': 'Paris',
            'guest_count': 100,
            'ceremony_type': 'outdoor',
        }, headers=headers)
        assert res.status_code == 402
        assert 'Starter' in res.get_json().get('error', '')

    def test_starter_plan_limit_enforcement(self, app, client, db_session):
        user, headers = _make_user_and_token(app, db_session)
        w = _make_wedding(db_session, user.id, plan='starter')
        user.current_wedding_id = w.id
        db_session.session.commit()

        # Exhaust the 3-per-day limit
        with app.app_context():
            for _ in range(3):
                AIUsage.increment(w.id)

        # Next call should be rate-limited
        with patch('src.services.ai_service.call_claude', return_value='{}'):
            res = client.post('/api/ai/timeline', json={
                'wedding_date': '2027-01-01',
                'location': 'Paris',
                'guest_count': 100,
                'ceremony_type': 'outdoor',
            }, headers=headers)
        assert res.status_code == 429

    def test_premium_plan_unlimited(self, app, client, db_session):
        user, headers = _make_user_and_token(app, db_session)
        w = _make_wedding(db_session, user.id, plan='premium')
        user.current_wedding_id = w.id
        db_session.session.commit()

        # Even with high count, premium should not be rate-limited
        with app.app_context():
            for _ in range(10):
                AIUsage.increment(w.id)

        with patch('src.services.ai_service.call_claude', return_value='{"timeline": []}'):
            res = client.post('/api/ai/timeline', json={
                'wedding_date': '2027-01-01',
                'location': 'Paris',
                'guest_count': 100,
                'ceremony_type': 'outdoor',
            }, headers=headers)
        # Should not be 429 for premium
        assert res.status_code != 429

    def test_plan_gate_requires_starter(self, app, client, db_session):
        user, headers = _make_user_and_token(app, db_session)
        w = _make_wedding(db_session, user.id, plan='free')
        user.current_wedding_id = w.id
        db_session.session.commit()

        res = client.post('/api/ai/vendor-suggestions', json={
            'budget': 20000,
            'location': 'Rome',
            'style_preferences': 'romantic',
            'guest_count': 80,
        }, headers=headers)
        assert res.status_code == 402

    def test_ai_usage_route(self, app, client, db_session):
        user, headers = _make_user_and_token(app, db_session)
        w = _make_wedding(db_session, user.id, plan='starter')
        user.current_wedding_id = w.id
        db_session.session.commit()

        res = client.get('/api/ai/usage', headers=headers)
        assert res.status_code == 200
        data = res.get_json()
        assert 'count' in data
        assert 'limit' in data
        assert data['plan'] == 'starter'


# ─── Wedding Model Unit Tests ─────────────────────────────────────────────────

class TestWeddingModel:
    def test_meets_plan(self, app, db_session):
        user, _ = _make_user_and_token(app, db_session)
        w_free = _make_wedding(db_session, user.id, plan='free')
        assert w_free.meets_plan('free') is True
        assert w_free.meets_plan('starter') is False
        assert w_free.meets_plan('premium') is False

    def test_meets_plan_starter(self, app, db_session):
        user, _ = _make_user_and_token(app, db_session)
        w = _make_wedding(db_session, user.id, plan='starter')
        assert w.meets_plan('free') is True
        assert w.meets_plan('starter') is True
        assert w.meets_plan('premium') is False

    def test_meets_plan_premium(self, app, db_session):
        user, _ = _make_user_and_token(app, db_session)
        w = _make_wedding(db_session, user.id, plan='premium')
        assert w.meets_plan('free') is True
        assert w.meets_plan('starter') is True
        assert w.meets_plan('premium') is True

    def test_get_limit(self, app, db_session):
        user, _ = _make_user_and_token(app, db_session)
        w_free = _make_wedding(db_session, user.id, plan='free')
        assert w_free.get_limit('max_guests') == 30
        assert w_free.get_limit('ai_uses_per_day') == 0

        w_premium = _make_wedding(db_session, user.id, plan='premium')
        assert w_premium.get_limit('max_guests') is None  # unlimited
        assert w_premium.get_limit('ai_uses_per_day') is None  # unlimited

    def test_to_dict(self, app, db_session):
        user, _ = _make_user_and_token(app, db_session)
        w = _make_wedding(db_session, user.id, plan='starter', slug='test-slug')
        d = w.to_dict()
        assert d['slug'] == 'test-slug'
        assert d['plan'] == 'starter'
        assert 'limits' in d
        assert d['limits']['max_guests'] == 150
