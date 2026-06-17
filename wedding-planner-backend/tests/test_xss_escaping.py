"""Output-escaping guards for couple-controlled free text (F20).

Couple-controlled text must render inert wherever it lands in HTML. The two
server-side surfaces are:

  * the public site renderer — covered in test_public_site.py
    (``test_published_site_renders_200_and_escapes_injected_script``); and
  * every transactional email, pinned here.

``wedding_content.message`` and the legacy CMS content are client-rendered: React
auto-escapes text nodes, and the single field rendered as HTML
(``guest_gift_message``) is sanitized with DOMPurify before
``dangerouslySetInnerHTML``. So the only server-side render path that interpolates
couple text into HTML is email — historically the invitation template did NOT
escape ``guest_name`` (P1 escaped the other templates). These tests lock that down.
"""
import os
import sys
import types
import asyncio
import importlib.util as _ilu

os.environ.setdefault("JWT_SECRET_KEY", "test-secret")

_SRC = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "src"))
if _SRC not in sys.path:
    sys.path.insert(0, _SRC)

# Other test modules install a STUB `services.email_service` (AsyncMock'd) into
# sys.modules. Force-load the real module straight from its file so these tests
# exercise the genuine escaping logic regardless of suite ordering. It imports
# only stdlib at module level (httpx is lazy, inside the patched send helper).
_es_path = os.path.join(_SRC, "services", "email_service.py")
_es_spec = _ilu.spec_from_file_location("_real_email_service", _es_path)
email_service = _ilu.module_from_spec(_es_spec)
_es_spec.loader.exec_module(email_service)

XSS = "<script>alert('pwn')</script>"


def run(coro):
    return asyncio.get_event_loop().run_until_complete(coro)


def _capture(monkeypatch):
    """Intercept the Resend call and capture the rendered email instead of sending."""
    sent = {}

    async def fake_send(to, subject, html):
        sent.update(to=to, subject=subject, html=html)
        return True

    monkeypatch.setattr(email_service, "_send_via_resend", fake_send)
    return sent


def _assert_inert(html):
    assert XSS not in html              # the raw script tag never reaches the client
    assert "&lt;script&gt;" in html    # it is present, but as escaped text


def test_invitation_email_default_template_escapes_guest_name(monkeypatch):
    sent = _capture(monkeypatch)
    run(email_service.send_invitation_email(
        email="g@example.com", token="tok123", guest_name=XSS,
        frontend_url="https://app.example.dev"))
    _assert_inert(sent["html"])


def test_invitation_email_custom_template_escapes_guest_name(monkeypatch):
    sent = _capture(monkeypatch)
    template = types.SimpleNamespace(
        subject="Hi {guest_name}",
        html_content="<p>Dear {guest_name} — RSVP at {invitation_link}</p>",
    )
    run(email_service.send_invitation_email(
        email="g@example.com", token="tok123", guest_name=XSS,
        frontend_url="https://app.example.dev", template=template))
    _assert_inert(sent["html"])


def test_welcome_email_escapes_couple_name(monkeypatch):
    sent = _capture(monkeypatch)
    run(email_service.send_welcome_email(email="c@example.com", couple_name=XSS, slug="x"))
    _assert_inert(sent["html"])


def test_rsvp_notification_email_escapes_guest_name(monkeypatch):
    sent = _capture(monkeypatch)
    run(email_service.send_rsvp_notification_email(
        admin_email="c@example.com", guest_name=XSS, rsvp_status="attending",
        wedding_date="2099-01-01"))
    _assert_inert(sent["html"])
