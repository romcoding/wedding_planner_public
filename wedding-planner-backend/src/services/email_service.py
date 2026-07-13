"""
Email service using Resend (pure Python, Pyodide-compatible).
"""
import os
import html as _html
import logging

from services.urls import rsvp_link

logger = logging.getLogger(__name__)


def _from_address() -> str:
    """Resolve the sender address.

    Priority:
      1. `FROM_EMAIL` secret (if set, used verbatim)
      2. `noreply@{RESEND_SENDER_DOMAIN}` if a sender domain is configured
      3. Resend's default sandbox sender
    """
    explicit = os.environ.get("FROM_EMAIL", "").strip()
    if explicit:
        return explicit if "<" in explicit else f"Wedding OS <{explicit}>"
    domain = os.environ.get("RESEND_SENDER_DOMAIN", "").strip()
    if domain:
        return f"Wedding OS <noreply@{domain}>"
    return "Wedding OS <onboarding@resend.dev>"


def _unsubscribe_footer() -> str:
    """Plain, compliant footer used on every transactional email."""
    return (
        '<p style="color: #999; font-size: 12px; text-align: center; margin-top: 32px; '
        'line-height: 1.6;">'
        "You're receiving this because you have an active Wedding OS workspace. "
        "If this wasn't you, you can safely ignore the email."
        "</p>"
    )


async def _send_via_resend(to: str, subject: str, html: str) -> bool:
    """Send email via Resend API using httpx."""
    resend_api_key = os.environ.get("RESEND_API_KEY", "")
    from_email = _from_address()
    if not resend_api_key:
        logger.error(f"[email] RESEND_API_KEY not set, skipping email to {to}")
        return False
    try:
        import httpx
        async with httpx.AsyncClient(timeout=10.0) as client:
            response = await client.post(
                "https://api.resend.com/emails",
                headers={"Authorization": f"Bearer {resend_api_key}", "Content-Type": "application/json"},
                json={"from": from_email, "to": [to], "subject": subject, "html": html},
            )
        if response.status_code >= 400:
            logger.error(
                f"[email] Resend rejected email to {to} with status {response.status_code}: {response.text}"
            )
            return False
        logger.info(f"[email] Sent email to {to} via Resend")
        return True
    except Exception as e:
        logger.error(f"Failed to send email to {to}: {e}")
        return False


async def send_welcome_email(email: str, couple_name: str, slug: str) -> bool:
    """Send welcome email to a newly registered couple."""
    frontend_url = os.environ.get("FRONTEND_URL", "http://localhost:5173")
    dashboard_url = f"{frontend_url}/admin/wedding"
    portal_url = f"{frontend_url}/w/{slug}"
    subject = f"Welcome to Wedding Planner, {couple_name}!"
    safe_couple = _html.escape(couple_name or "")
    html = f"""
    <!DOCTYPE html>
    <html>
    <body style="font-family: -apple-system, sans-serif; max-width: 600px; margin: 0 auto; padding: 40px 20px;">
      <div style="text-align: center; margin-bottom: 32px;">
        <h1 style="color: #d63384; font-size: 32px; margin: 0;">💍 Welcome!</h1>
        <p style="color: #666; font-size: 18px; margin-top: 8px;">Your wedding OS is ready</p>
      </div>
      <p style="color: #333; font-size: 16px; line-height: 1.6;">
        Congratulations, {safe_couple}! Your wedding planning dashboard is set up and ready to go.
      </p>
      <div style="background: #fdf4ff; border-radius: 12px; padding: 24px; margin: 24px 0;">
        <p style="margin: 0 0 16px; font-weight: 600; color: #333;">Get started:</p>
        <ul style="margin: 0; padding-left: 20px; color: #555; line-height: 2;">
          <li>Add your guests and send invitations</li>
          <li>Track your budget and costs</li>
          <li>Manage tasks and timeline</li>
          <li>Share your guest portal: <a href="{portal_url}" style="color: #d63384;">{portal_url}</a></li>
        </ul>
      </div>
      <div style="text-align: center; margin: 32px 0;">
        <a href="{dashboard_url}"
           style="background: #d63384; color: white; padding: 14px 32px; border-radius: 8px;
                  text-decoration: none; font-weight: 600; font-size: 16px; display: inline-block;">
          Open Dashboard
        </a>
      </div>
      <p style="color: #999; font-size: 14px; text-align: center; margin-top: 32px;">
        Wedding Planner
      </p>
    </body>
    </html>
    """
    return await _send_via_resend(email, subject, html)


async def send_plan_upgrade_email(email: str, couple_name: str, new_plan: str) -> bool:
    """Send confirmation email when a couple upgrades their plan."""
    plan_display = new_plan.capitalize()
    subject = f"You're now on the {plan_display} plan!"
    safe_couple = _html.escape(couple_name or "")
    html = f"""
    <!DOCTYPE html>
    <html>
    <body style="font-family: -apple-system, sans-serif; max-width: 600px; margin: 0 auto; padding: 40px 20px;">
      <div style="text-align: center; margin-bottom: 32px;">
        <h1 style="color: #d63384; font-size: 28px;">Plan Upgraded! 🎉</h1>
      </div>
      <p style="color: #333; font-size: 16px; line-height: 1.6;">
        Hi {safe_couple}, your plan has been upgraded to <strong>{plan_display}</strong>.
        Enjoy your new features!
      </p>
      <p style="color: #999; font-size: 14px; text-align: center; margin-top: 32px;">
        Wedding Planner
      </p>
    </body>
    </html>
    """
    return await _send_via_resend(email, subject, html)


async def send_verification_email(email: str, couple_name: str, token: str) -> bool:
    """Send email-verification link to a newly registered couple."""
    frontend_url = os.environ.get("FRONTEND_URL", "http://localhost:5173")
    verify_url = f"{frontend_url}/verify-email?token={token}"
    subject = "Verify your Wedding Planner email"
    safe_couple = _html.escape(couple_name or "")
    html = f"""
    <!DOCTYPE html>
    <html>
    <body style="font-family: -apple-system, sans-serif; max-width: 600px; margin: 0 auto; padding: 40px 20px;">
      <div style="text-align: center; margin-bottom: 32px;">
        <h1 style="color: #d63384; font-size: 28px; margin: 0;">💍 Confirm your email</h1>
        <p style="color: #666; font-size: 16px; margin-top: 8px;">One quick step before you start planning</p>
      </div>
      <p style="color: #333; font-size: 16px; line-height: 1.6;">Hi {safe_couple},</p>
      <p style="color: #555; font-size: 16px; line-height: 1.6;">
        Click the button below to verify your email address and activate your Wedding Planner account.
        The link expires in <strong>24 hours</strong>.
      </p>
      <div style="text-align: center; margin: 32px 0;">
        <a href="{verify_url}"
           style="background: #d63384; color: white; padding: 14px 32px; border-radius: 8px;
                  text-decoration: none; font-weight: 600; font-size: 16px; display: inline-block;">
          Verify my email
        </a>
      </div>
      <p style="color: #999; font-size: 13px; text-align: center;">
        Or copy this link: <a href="{verify_url}" style="color: #d63384;">{verify_url}</a>
      </p>
      <p style="color: #bbb; font-size: 12px; text-align: center; margin-top: 24px;">
        If you didn't create this account you can safely ignore this email.
      </p>
    </body>
    </html>
    """
    return await _send_via_resend(email, subject, html)


async def send_password_reset_email(email: str, user_name: str, token: str) -> bool:
    """Send a password-reset link."""
    frontend_url = os.environ.get("FRONTEND_URL", "http://localhost:5173")
    reset_url = f"{frontend_url}/reset-password?token={token}"
    subject = "Reset your Wedding Planner password"
    safe_name = _html.escape(user_name or "")
    html = f"""
    <!DOCTYPE html>
    <html>
    <body style="font-family: -apple-system, sans-serif; max-width: 600px; margin: 0 auto; padding: 40px 20px;">
      <div style="text-align: center; margin-bottom: 32px;">
        <h1 style="color: #d63384; font-size: 28px; margin: 0;">🔐 Password reset</h1>
        <p style="color: #666; font-size: 16px; margin-top: 8px;">We got your request</p>
      </div>
      <p style="color: #333; font-size: 16px; line-height: 1.6;">Hi {safe_name},</p>
      <p style="color: #555; font-size: 16px; line-height: 1.6;">
        Click the button below to choose a new password.
        This link expires in <strong>1 hour</strong>.
      </p>
      <div style="text-align: center; margin: 32px 0;">
        <a href="{reset_url}"
           style="background: #d63384; color: white; padding: 14px 32px; border-radius: 8px;
                  text-decoration: none; font-weight: 600; font-size: 16px; display: inline-block;">
          Reset my password
        </a>
      </div>
      <p style="color: #999; font-size: 13px; text-align: center;">
        Or copy: <a href="{reset_url}" style="color: #d63384;">{reset_url}</a>
      </p>
      <p style="color: #bbb; font-size: 12px; text-align: center; margin-top: 24px;">
        If you didn't request this, ignore this email — your password won't change.
      </p>
    </body>
    </html>
    """
    return await _send_via_resend(email, subject, html)


async def send_rsvp_notification_email(
    admin_email: str,
    guest_name: str,
    rsvp_status: str,
    wedding_date: str | None = None,
) -> bool:
    """Notify the couple/admin that a guest just responded to their invitation."""
    frontend_url = os.environ.get("FRONTEND_URL", "http://localhost:5173")
    guest_list_url = f"{frontend_url}/admin/guests"

    status_label = (rsvp_status or "").strip().lower()
    if status_label in ("accepted", "confirmed", "coming", "yes"):
        emoji = "✅"
        verb = "is coming"
    elif status_label in ("declined", "no", "cant_make_it"):
        emoji = "❌"
        verb = "can't make it"
    else:
        emoji = "📨"
        verb = "responded"

    safe_name = _html.escape(guest_name or "A guest")
    safe_date = _html.escape(str(wedding_date)) if wedding_date else ""
    date_line = (
        f'<p style="color: #888; font-size: 14px; text-align: center; margin: 8px 0 24px;">'
        f"Your wedding date: <strong>{safe_date}</strong></p>"
        if wedding_date else ""
    )

    subject = f"{safe_name} just responded to your wedding invitation!"
    html = f"""
    <!DOCTYPE html>
    <html>
    <body style="font-family: -apple-system, sans-serif; max-width: 600px; margin: 0 auto; padding: 40px 20px; background:#FAFAF8;">
      <div style="text-align: center; margin-bottom: 24px;">
        <div style="font-size: 40px;">{emoji}</div>
        <h1 style="color: #2D4A3E; font-size: 24px; margin: 8px 0 0;">New RSVP</h1>
      </div>
      <p style="color: #1A1A1A; font-size: 16px; line-height: 1.6; text-align: center;">
        <strong>{safe_name}</strong> {verb}.
      </p>
      {date_line}
      <div style="text-align: center; margin: 32px 0;">
        <a href="{guest_list_url}"
           style="background: #C4956A; color: white; padding: 12px 28px; border-radius: 8px;
                  text-decoration: none; font-weight: 600; font-size: 15px; display: inline-block;">
          View guest list
        </a>
      </div>
      {_unsubscribe_footer()}
    </body>
    </html>
    """
    return await _send_via_resend(admin_email, subject, html)


async def send_upgrade_confirmation_email(email: str, couple_names: str, plan_type: str) -> bool:
    """Confirm a successful upgrade to a paid plan."""
    plan_display = "Premium" if plan_type in ("premium", "lifetime") else plan_type.title()
    perks = [
        "Unlimited guests, tasks, and RSVPs",
        "Full planning assistant with Wedi",
        "Beautiful guest portal & custom slug",
        "Detailed budget tracking and exports",
    ]
    perks_html = "".join(
        f'<li style="margin: 6px 0;">{p}</li>' for p in perks
    )

    frontend_url = os.environ.get("FRONTEND_URL", "http://localhost:5173")
    dashboard_url = f"{frontend_url}/admin/billing"
    subject = "You're now on Premium! 🎉"
    html = f"""
    <!DOCTYPE html>
    <html>
    <body style="font-family: -apple-system, sans-serif; max-width: 600px; margin: 0 auto; padding: 40px 20px; background:#FAFAF8;">
      <div style="text-align: center; margin-bottom: 24px;">
        <div style="font-size: 44px;">🎉</div>
        <h1 style="color: #2D4A3E; font-size: 28px; margin: 8px 0 4px;">Welcome to {plan_display}</h1>
        <p style="color: #666; font-size: 16px; margin: 0;">Hi {_html.escape(couple_names) if couple_names else "there"}, your upgrade is live.</p>
      </div>
      <div style="background:#F5EFE8; border-radius: 12px; padding: 20px 24px; margin: 16px 0 28px;">
        <p style="margin: 0 0 8px; font-weight: 600; color: #1A1A1A;">What's now unlocked:</p>
        <ul style="margin: 0; padding-left: 20px; color: #333; line-height: 1.8;">{perks_html}</ul>
      </div>
      <div style="text-align: center; margin: 28px 0;">
        <a href="{dashboard_url}"
           style="background: #C4956A; color: white; padding: 14px 32px; border-radius: 8px;
                  text-decoration: none; font-weight: 600; font-size: 16px; display: inline-block;">
          Open billing
        </a>
      </div>
      <p style="color: #888; font-size: 13px; text-align: center;">
        A receipt is available in your Stripe customer portal.
      </p>
      {_unsubscribe_footer()}
    </body>
    </html>
    """
    return await _send_via_resend(email, subject, html)


# Backwards-compatible alias used by older callers.
send_plan_upgrade_email = send_upgrade_confirmation_email


async def send_subscription_cancelled_email(email: str, user_name: str) -> bool:
    """Notify the couple that their paid plan was cancelled and they're back on Free."""
    frontend_url = os.environ.get("FRONTEND_URL", "http://localhost:5173")
    billing_url = f"{frontend_url}/admin/billing"
    subject = "Your subscription was cancelled"
    html = f"""
    <!DOCTYPE html>
    <html>
    <body style="font-family: -apple-system, sans-serif; max-width: 600px; margin: 0 auto; padding: 40px 20px; background:#FAFAF8;">
      <h1 style="color: #2D4A3E; font-size: 24px; margin: 0 0 16px;">Subscription cancelled</h1>
      <p style="color: #1A1A1A; font-size: 16px; line-height: 1.6;">
        Hi {_html.escape(user_name) if user_name else "there"}, your Wedding OS subscription has been cancelled and
        your workspace has been moved back to the <strong>Free</strong> plan.
      </p>
      <p style="color: #333; font-size: 15px; line-height: 1.6;">
        All of your data is safe — guests, tasks, budget items, and content are all still
        here. Free-tier limits will apply going forward.
      </p>
      <div style="text-align: center; margin: 32px 0;">
        <a href="{billing_url}"
           style="background: #2D4A3E; color: white; padding: 12px 26px; border-radius: 8px;
                  text-decoration: none; font-weight: 600; font-size: 15px; display: inline-block;">
          Manage billing
        </a>
      </div>
      {_unsubscribe_footer()}
    </body>
    </html>
    """
    return await _send_via_resend(email, subject, html)


async def send_guest_confirmation_email(
    guest_email: str,
    guest_name: str,
    couple_names: str,
    wedding_date: str | None,
    portal_url: str,
) -> bool:
    """Send a guest a beautiful RSVP confirmation."""
    safe_couple = _html.escape(couple_names or "the couple")
    safe_name = _html.escape(guest_name or "Guest")
    safe_date = _html.escape(str(wedding_date)) if wedding_date else ""
    date_block = (
        f'<p style="color:#2D4A3E; text-align:center; font-size: 18px; margin: 8px 0 24px;">'
        f"📅 <strong>{safe_date}</strong></p>"
        if wedding_date else ""
    )

    subject = f"Your RSVP is confirmed — {safe_couple}'s wedding"
    html = f"""
    <!DOCTYPE html>
    <html>
    <body style="font-family: 'DM Sans', -apple-system, sans-serif; max-width: 600px; margin: 0 auto; padding: 40px 20px; background:#FAFAF8;">
      <div style="text-align: center; margin-bottom: 24px;">
        <div style="font-size: 40px;">💌</div>
        <h1 style="font-family: 'Playfair Display', Georgia, serif; color: #2D4A3E; font-size: 32px; margin: 8px 0 4px;">
          Your RSVP is confirmed
        </h1>
        <p style="color: #C4956A; font-size: 16px; margin: 0;">Thank you, {safe_name}!</p>
      </div>
      <p style="color: #1A1A1A; font-size: 16px; line-height: 1.7; text-align: center;">
        We've let <strong>{safe_couple}</strong> know you're in. They'll be in touch with details closer to the day.
      </p>
      {date_block}
      <div style="text-align: center; margin: 28px 0;">
        <a href="{portal_url}"
           style="background: #C4956A; color: white; padding: 14px 32px; border-radius: 8px;
                  text-decoration: none; font-weight: 600; font-size: 15px; display: inline-block;">
          View wedding portal
        </a>
      </div>
      <p style="color: #888; font-size: 13px; text-align: center;">
        Need to change your response? Open the portal above any time.
      </p>
      {_unsubscribe_footer()}
    </body>
    </html>
    """
    return await _send_via_resend(guest_email, subject, html)


async def send_invitation_email(
    email: str,
    token: str,
    guest_name: str,
    frontend_url: str,
    template=None,
) -> bool:
    """Send RSVP invitation email to a guest."""
    invitation_link = rsvp_link(frontend_url, token)
    subject = "You're Invited to Our Wedding! 💍✨"
    # guest_name is couple-controlled free text; escape before it lands in HTML.
    # The subject is a plain-text header, so it uses the raw name.
    safe_name = _html.escape(guest_name or "Guest")

    if template:
        subject = getattr(template, "subject", subject).replace("{guest_name}", guest_name or "Guest")
        html = getattr(template, "html_content", "").replace("{guest_name}", safe_name)
        html = html.replace("{invitation_link}", _html.escape(invitation_link))
    else:
        html = f"""
        <!DOCTYPE html>
        <html>
        <body style="font-family: -apple-system, sans-serif; max-width: 600px; margin: 0 auto; padding: 40px 20px;">
          <div style="text-align: center; background: linear-gradient(135deg, #fce7f3, #f3e8ff); padding: 40px; border-radius: 16px; margin-bottom: 24px;">
            <div style="font-size: 48px; margin-bottom: 16px;">💍✨</div>
            <h1 style="color: #d63384; margin: 0; font-size: 36px;">You're Invited!</h1>
            <p style="color: #764ba2; font-size: 18px; margin-top: 8px;">Join us for our special celebration</p>
          </div>
          <p style="color: #333; font-size: 16px; line-height: 1.6;">Dear {safe_name},</p>
          <p style="color: #555; font-size: 16px; line-height: 1.6;">
            We're thrilled to invite you to celebrate our wedding! Please click below to RSVP.
          </p>
          <div style="text-align: center; margin: 32px 0;">
            <a href="{invitation_link}"
               style="background: linear-gradient(135deg, #d63384, #f5576c); color: white;
                      padding: 16px 40px; border-radius: 50px; text-decoration: none;
                      font-weight: 700; font-size: 18px; display: inline-block;">
              ✨ RSVP Now ✨
            </a>
          </div>
          <p style="color: #999; font-size: 13px; text-align: center;">
            Or copy: <a href="{invitation_link}" style="color: #d63384;">{invitation_link}</a>
          </p>
          <p style="color: #d63384; font-size: 18px; text-align: center; margin-top: 32px;">
            💕 With love, The Happy Couple 💕
          </p>
        </body>
        </html>
        """

    return await _send_via_resend(email, subject, html)
