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
