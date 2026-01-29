"""Unit tests for messages API (contact form)."""
import os
from unittest.mock import patch

from src.models import Message, Guest


class TestCreateMessage:
    """Tests for POST /api/messages (create_message)."""

    def test_valid_payload_guest_token_201(self, client, guest):
        """Valid payload with guest token returns 201, message stored, delivery_status in response."""
        token = guest['token']
        payload = {
            'subject': 'Test subject',
            'body': 'Test body content',
            'idempotency_key': 'test-key-001',
        }
        with patch.dict(os.environ, {'CONTACT_FORWARD_EMAIL': ''}, clear=False):
            resp = client.post(
                '/api/messages',
                json=payload,
                headers={'Authorization': f'Bearer {token}'},
            )
        assert resp.status_code == 201
        data = resp.get_json()
        assert 'message_data' in data
        msg_data = data['message_data']
        assert msg_data['subject'] == 'Test subject'
        assert msg_data['body'] == 'Test body content'
        assert msg_data['delivery_status'] in ('received', 'sent', 'failed')
        assert msg_data.get('id') is not None

        # Verify stored in DB
        msg = Message.query.get(msg_data['id'])
        assert msg is not None
        assert msg.subject == 'Test subject'
        assert msg.guest_id == guest['guest'].id

    def test_invalid_payload_missing_subject_400(self, client, guest):
        """Invalid payload (missing subject) returns 400, no record."""
        token = guest['token']
        payload = {'body': 'Only body'}
        resp = client.post(
            '/api/messages',
            json=payload,
            headers={'Authorization': f'Bearer {token}'},
        )
        assert resp.status_code == 400
        assert Message.query.count() == 0

    def test_invalid_payload_missing_body_400(self, client, guest):
        """Invalid payload (missing body) returns 400, no record."""
        token = guest['token']
        payload = {'subject': 'Only subject'}
        resp = client.post(
            '/api/messages',
            json=payload,
            headers={'Authorization': f'Bearer {token}'},
        )
        assert resp.status_code == 400
        assert Message.query.count() == 0

    def test_duplicate_idempotency_key_200(self, client, guest):
        """Duplicate idempotency_key returns 200 with existing message, no duplicate."""
        token = guest['token']
        payload = {
            'subject': 'First',
            'body': 'First body',
            'idempotency_key': 'idem-dup-001',
        }
        resp1 = client.post(
            '/api/messages',
            json=payload,
            headers={'Authorization': f'Bearer {token}'},
        )
        assert resp1.status_code == 201
        first_id = resp1.get_json()['message_data']['id']

        # Same idempotency key again
        payload2 = {
            'subject': 'Second',
            'body': 'Second body',
            'idempotency_key': 'idem-dup-001',
        }
        resp2 = client.post(
            '/api/messages',
            json=payload2,
            headers={'Authorization': f'Bearer {token}'},
        )
        assert resp2.status_code == 200
        data2 = resp2.get_json()
        assert data2['message_data']['id'] == first_id
        assert data2['message_data']['subject'] == 'First'  # Original, not Second

        # Only one message in DB
        assert Message.query.filter_by(idempotency_key='idem-dup-001').count() == 1

    def test_honeypot_filled_400(self, client, guest):
        """Honeypot filled returns 400."""
        token = guest['token']
        payload = {
            'subject': 'Test',
            'body': 'Test body',
            '_hp': 'bot filled this',
        }
        resp = client.post(
            '/api/messages',
            json=payload,
            headers={'Authorization': f'Bearer {token}'},
        )
        assert resp.status_code == 400
        assert Message.query.count() == 0

    def test_rate_limit_exceeded_429(self, client, guest):
        """Rate limit exceeded returns 429."""
        # Clear rate limit store so we start fresh (other tests may have used it)
        from src.routes.messages import _RATE_LIMIT_STORE, _RATE_LIMIT_LOCK
        with _RATE_LIMIT_LOCK:
            _RATE_LIMIT_STORE.clear()

        token = guest['token']
        payload = {
            'subject': 'Test',
            'body': 'Test body',
        }
        # Send 6 messages (limit is 5 per hour)
        for i in range(6):
            p = {
                'subject': f'Test {i}',
                'body': f'Body {i}',
                'idempotency_key': f'rate-limit-{i}',
            }
            resp = client.post(
                '/api/messages',
                json=p,
                headers={'Authorization': f'Bearer {token}'},
            )
            if i < 5:
                assert resp.status_code == 201, f"Message {i} should succeed"
            else:
                assert resp.status_code == 429, f"Message {i} should be rate limited"

    def test_email_service_called_when_forward_configured(self, client, guest):
        """When CONTACT_FORWARD_EMAIL is set, EmailService.send_notification_email is called."""
        token = guest['token']
        payload = {
            'subject': 'Email test',
            'body': 'Email body',
            'idempotency_key': 'email-test-001',
        }
        with patch.dict(os.environ, {'CONTACT_FORWARD_EMAIL': 'admin@wedding.com'}):
            with patch('src.routes.messages.EmailService') as mock_email:
                mock_email.send_notification_email.return_value = True
                resp = client.post(
                    '/api/messages',
                    json=payload,
                    headers={'Authorization': f'Bearer {token}'},
                )
        assert resp.status_code == 201
        mock_email.send_notification_email.assert_called_once()
        call_args = mock_email.send_notification_email.call_args
        assert call_args[0][0] == 'admin@wedding.com'
        assert '[Wedding Planner]' in call_args[0][1]
        assert 'Email test' in call_args[0][1]
        assert 'Email body' in call_args[0][2]
