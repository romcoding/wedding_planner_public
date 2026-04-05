import json


def _login(client, admin_user):
    response = client.post('/api/auth/login', json={'email': admin_user.email, 'password': 'adminpass'})
    assert response.status_code == 200
    return response.get_json()['access_token']


def test_moodboard_save_load_extended_fields(client, init_db, admin_user):
    token = _login(client, admin_user)

    create = client.post(
        '/api/moodboards',
        headers={'Authorization': f'Bearer {token}'},
        json={'title': 'Template Board'},
    )
    assert create.status_code == 201
    board_id = create.get_json()['id']

    content = {
        'version': 2,
        'stage': {'x': 20, 'y': 30, 'scale': 0.7},
        'palette': ['#111827', '#EC4899'],
        'objects': [],
        'template_id': 'rustic',
        'quick_actions': {'last_shape': 'circle'},
        'imported_palette_url': 'https://coolors.co/264653-2a9d8f-e9c46a',
    }

    save = client.put(
        f'/api/moodboards/{board_id}',
        headers={'Authorization': f'Bearer {token}'},
        json={'contentJson': content},
    )
    assert save.status_code == 200

    get_resp = client.get(f'/api/moodboards/{board_id}', headers={'Authorization': f'Bearer {token}'})
    assert get_resp.status_code == 200
    payload = get_resp.get_json()
    parsed = json.loads(payload['contentJson'])
    assert parsed['template_id'] == 'rustic'
    assert parsed['imported_palette_url'] == 'https://coolors.co/264653-2a9d8f-e9c46a'


def test_moodboard_rejects_invalid_json_string(client, init_db, admin_user):
    token = _login(client, admin_user)

    create = client.post(
        '/api/moodboards',
        headers={'Authorization': f'Bearer {token}'},
        json={'title': 'Bad JSON Board'},
    )
    assert create.status_code == 201
    board_id = create.get_json()['id']

    invalid = client.put(
        f'/api/moodboards/{board_id}',
        headers={'Authorization': f'Bearer {token}'},
        json={'contentJson': '{not-json'},
    )
    assert invalid.status_code == 400
