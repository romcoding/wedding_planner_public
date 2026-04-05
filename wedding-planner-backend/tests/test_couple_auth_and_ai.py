from src.models import Event, User


def test_couple_register_creates_user_and_event(client, init_db):
    payload = {
        'email': 'couple@example.com',
        'password': 'secret123',
        'password_confirmation': 'secret123',
        'partner_one_first_name': 'Alex',
        'partner_one_last_name': 'Stone',
        'partner_two_first_name': 'Sam',
        'partner_two_last_name': 'River',
        'wedding_date': '2026-09-12',
        'location': 'Zurich',
        'style_notes': 'modern and cozy',
    }
    response = client.post('/api/auth/couple/register', json=payload)
    assert response.status_code == 201
    body = response.get_json()
    assert body['user']['email'] == 'couple@example.com'

    user = User.query.filter_by(email='couple@example.com').first()
    assert user is not None
    event = Event.query.filter_by(user_id=user.id).first()
    assert event is not None
    assert event.location == 'Zurich'


def test_webpage_command_rejects_non_admin(client, init_db, guest):
    response = client.post(
        '/api/ai/webpage-command',
        headers={'Authorization': f"Bearer {guest['token']}"},
        json={'message': 'Switch to modern template', 'current_config': {}},
    )
    assert response.status_code == 403


def test_webpage_command_updates_template(client, init_db, admin_user):
    login = client.post('/api/auth/login', json={'email': admin_user.email, 'password': 'adminpass'})
    token = login.get_json()['access_token']
    response = client.post(
        '/api/ai/webpage-command',
        headers={'Authorization': f'Bearer {token}'},
        json={'message': 'Please switch to modern template', 'current_config': {'template': 'classic'}},
    )
    assert response.status_code == 200
    body = response.get_json()
    assert body['updated_config']['template'] == 'modern'


def test_webpage_command_charges_tokens(client, init_db, admin_user):
    login = client.post('/api/auth/login', json={'email': admin_user.email, 'password': 'adminpass'})
    token = login.get_json()['access_token']

    response = client.post(
        '/api/ai/webpage-command',
        headers={'Authorization': f'Bearer {token}'},
        json={'message': 'set primary color to #112233 and switch to boho', 'current_config': {'template': 'classic'}},
    )
    assert response.status_code == 200
    body = response.get_json()
    assert body['meta']['tokens_charged'] > 0

    billing = client.get('/api/subscriptions', headers={'Authorization': f'Bearer {token}'})
    assert billing.status_code == 200
    data = billing.get_json()
    assert data['subscription']['balance_tokens'] < 100
    assert len(data['usage_history']) >= 1


def test_webpage_command_insufficient_tokens_returns_402(client, init_db, admin_user):
    from src.models import db, UserSubscription

    login = client.post('/api/auth/login', json={'email': admin_user.email, 'password': 'adminpass'})
    token = login.get_json()['access_token']

    sub = UserSubscription(user_id=admin_user.id, plan_type='free', balance_tokens=1, is_active=True)
    db.session.add(sub)
    db.session.commit()

    response = client.post(
        '/api/ai/webpage-command',
        headers={'Authorization': f'Bearer {token}'},
        json={'message': 'add agenda item for every hour with a long description ' * 10, 'current_config': {}},
    )
    assert response.status_code == 402


def test_venue_search_ai_returns_results_and_charges_tokens(client, init_db, admin_user, monkeypatch):
    from src.routes import venues as venues_routes

    login = client.post('/api/auth/login', json={'email': admin_user.email, 'password': 'adminpass'})
    token = login.get_json()['access_token']

    monkeypatch.setattr(venues_routes, '_duckduckgo_links', lambda query, limit=5: ['https://example.com/venue'])
    monkeypatch.setattr(
        venues_routes.VenueScraperService,
        'scrape_venue_from_url',
        lambda url: {
            'name': 'Alpine Hall',
            'description': 'Mountain wedding venue',
            'location': 'Zurich',
            'capacity': 120,
            'price_range': 'CHF 3000-5000',
            'style': 'Modern',
            'amenities': ['Parking'],
        },
    )

    response = client.post(
        '/api/venues/search-ai',
        headers={'Authorization': f'Bearer {token}'},
        json={'query': 'mountain venues in zurich'},
    )
    assert response.status_code == 200
    body = response.get_json()
    assert len(body['venues']) == 1
    assert body['meta']['tokens_charged'] > 0
