"""
Email service using Resend (pure Python, Pyodide-compatible).
"""
import os
import logging

logger = logging.getLogger(__name__)

RESEND_API_KEY = os.environ.get("RESEND_API_KEY", "")
FROM_EMAIL = os.environ.get("FROM_EMAIL", "noreply@wedding-planner.app")
FRONTEND_URL = os.environ.get("FRONTEND_URL", "http://localhost:5173")


async def _send_via_resend(to: str, subject: str, html: str) -> bool:
    """Send email via Resend API using httpx."""
    if not RESEND_API_KEY:
        logger.info(f"[email] RESEND_API_KEY not set, skipping email to {to}")
        return False
    try:
        import httpx
        response = httpx.post(
            "https://api.resend.com/emails",
            headers={"Authorization": f"Bearer {RESEND_API_KEY}", "Content-Type": "application/json"},
            json={"from": FROM_EMAIL, "to": [to], "subject": subject, "html": html},
            timeout=10.0,
        )
        response.raise_for_status()
        return True
    except Exception as e:
        logger.error(f"Failed to send email to {to}: {e}")
        return False


async def send_welcome_email(email: str, couple_name: str, slug: str) -> bool:
    """Send welcome email to a newly registered couple."""
    dashboard_url = f"{FRONTEND_URL}/admin/wedding"
    portal_url = f"{FRONTEND_URL}/w/{slug}"
    subject = f"Welcome to Wedding Planner, {couple_name}!"
    html = f"""
    <!DOCTYPE html>
    <html>
    <body style="font-family: -apple-system, sans-serif; max-width: 600px; margin: 0 auto; padding: 40px 20px;">
      <div style="text-align: center; margin-bottom: 32px;">
        <h1 style="color: #d63384; font-size: 32px; margin: 0;">💍 Welcome!</h1>
        <p style="color: #666; font-size: 18px; margin-top: 8px;">Your wedding OS is ready</p>
      </div>
      <p style="color: #333; font-size: 16px; line-height: 1.6;">
        Congratulations, {couple_name}! Your wedding planning dashboard is set up and ready to go.
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
        Wedding Planner — AI Wedding OS
      </p>
    </body>
    </html>
    """
    return await _send_via_resend(email, subject, html)


async def send_plan_upgrade_email(email: str, couple_name: str, new_plan: str) -> bool:
    """Send confirmation email when a couple upgrades their plan."""
    plan_display = new_plan.capitalize()
    subject = f"You're now on the {plan_display} plan!"
    html = f"""
    <!DOCTYPE html>
    <html>
    <body style="font-family: -apple-system, sans-serif; max-width: 600px; margin: 0 auto; padding: 40px 20px;">
      <div style="text-align: center; margin-bottom: 32px;">
        <h1 style="color: #d63384; font-size: 28px;">Plan Upgraded! 🎉</h1>
      </div>
      <p style="color: #333; font-size: 16px; line-height: 1.6;">
        Hi {couple_name}, your plan has been upgraded to <strong>{plan_display}</strong>.
        Enjoy your new features!
      </p>
      <p style="color: #999; font-size: 14px; text-align: center; margin-top: 32px;">
        Wedding Planner — AI Wedding OS
      </p>
    </body>
    </html>
    """
    return await _send_via_resend(email, subject, html)


async def send_invitation_email(
    email: str,
    token: str,
    guest_name: str,
    frontend_url: str,
    template=None,
) -> bool:
    """Send RSVP invitation email to a guest."""
    invitation_link = f"{frontend_url}/rsvp/{token}"
    subject = "You're Invited to Our Wedding! 💍✨"

    if template:
        subject = getattr(template, "subject", subject).replace("{guest_name}", guest_name or "Guest")
        html = getattr(template, "html_content", "").replace("{guest_name}", guest_name or "Guest")
        html = html.replace("{invitation_link}", invitation_link)
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
          <p style="color: #333; font-size: 16px; line-height: 1.6;">Dear {guest_name or "Guest"},</p>
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
