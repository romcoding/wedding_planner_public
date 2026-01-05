import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from flask import current_app
import os

class EmailService:
    """Service for sending emails"""
    
    @staticmethod
    def send_invitation_email(email, invitation_token, guest_name, frontend_url):
        """Send invitation email to guest"""
        try:
            # Get SMTP settings from environment
            smtp_host = os.getenv('SMTP_HOST', 'smtp.gmail.com')
            smtp_port = int(os.getenv('SMTP_PORT', '587'))
            smtp_user = os.getenv('SMTP_USER')
            smtp_password = os.getenv('SMTP_PASSWORD')
            from_email = os.getenv('SMTP_FROM_EMAIL', smtp_user)
            
            if not smtp_user or not smtp_password:
                # If no SMTP configured, log and return False
                print(f"SMTP not configured. Would send invitation to {email} with token {invitation_token}")
                return False
            
            # Create message with proper content type
            msg = MIMEMultipart('alternative')
            msg['Subject'] = "You're Invited to Our Wedding!"
            msg['From'] = from_email
            msg['To'] = email
            msg['Content-Type'] = 'text/html; charset=utf-8'
            
            # Create invitation link (direct to RSVP page for passwordless system)
            invitation_link = f"{frontend_url}/rsvp/{invitation_token}"
            
            # Create rich, joyful HTML email template
            html_body = f"""
            <!DOCTYPE html>
            <html>
              <head>
                <meta charset="utf-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <style>
                  @media only screen and (max-width: 600px) {{
                    .container {{ width: 100% !important; padding: 10px !important; }}
                    .button {{ padding: 14px 28px !important; font-size: 18px !important; }}
                    h1 {{ font-size: 36px !important; }}
                    .header-emoji {{ font-size: 48px !important; }}
                  }}
                </style>
              </head>
              <body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background: linear-gradient(135deg, #667eea 0%, #764ba2 25%, #f093fb 50%, #f5576c 75%, #4facfe 100%); background-size: 400% 400%; animation: gradient 15s ease infinite; line-height: 1.6;">
                <style>
                  @keyframes gradient {{
                    0% {{ background-position: 0% 50%; }}
                    50% {{ background-position: 100% 50%; }}
                    100% {{ background-position: 0% 50%; }}
                  }}
                </style>
                <table role="presentation" style="width: 100%; border-collapse: collapse; padding: 40px 20px;">
                  <tr>
                    <td align="center" style="padding: 20px 0;">
                      <table role="presentation" class="container" style="max-width: 600px; width: 100%; background-color: #ffffff; border-radius: 20px; box-shadow: 0 10px 40px rgba(0,0,0,0.2); margin: 0 auto; overflow: hidden;">
                        <!-- Header with gradient and emoji -->
                        <tr>
                          <td style="padding: 50px 30px; text-align: center; background: linear-gradient(135deg, #fce7f3 0%, #f3e8ff 50%, #e0e7ff 100%); border-radius: 20px 20px 0 0; position: relative; overflow: hidden;">
                            <div class="header-emoji" style="font-size: 64px; margin-bottom: 10px; animation: bounce 2s ease-in-out infinite;">💍✨</div>
                            <h1 style="margin: 0; color: #d63384; font-size: 48px; font-weight: 800; letter-spacing: -1px; text-shadow: 2px 2px 4px rgba(214, 51, 132, 0.2);">You're Invited!</h1>
                            <p style="margin: 10px 0 0; color: #764ba2; font-size: 20px; font-weight: 500;">Join us for our special celebration</p>
                            <style>
                              @keyframes bounce {{
                                0%, 100% {{ transform: translateY(0); }}
                                50% {{ transform: translateY(-10px); }}
                              }}
                            </style>
                          </td>
                        </tr>
                        <!-- Main content -->
                        <tr>
                          <td style="padding: 40px 30px;">
                            <p style="margin: 0 0 20px; color: #333333; font-size: 18px; font-weight: 600;">Dear {guest_name or 'Guest'},</p>
                            <p style="margin: 0 0 20px; color: #555555; font-size: 16px; line-height: 1.8;">We're absolutely <span style="color: #d63384; font-weight: 600;">thrilled</span> to invite you to celebrate our special day with us! 🎉</p>
                            <p style="margin: 0 0 30px; color: #555555; font-size: 16px; line-height: 1.8;">Your presence would make our celebration even more meaningful. Please click the button below to register and RSVP:</p>
                          </td>
                        </tr>
                        <!-- CTA Button -->
                        <tr>
                          <td align="center" style="padding: 0 30px 30px;">
                            <a href="{invitation_link}" 
                               class="button"
                               style="background: linear-gradient(135deg, #d63384 0%, #f5576c 100%); color: #ffffff; padding: 18px 50px; text-decoration: none; border-radius: 50px; display: inline-block; font-weight: 700; font-size: 20px; letter-spacing: 0.5px; box-shadow: 0 8px 20px rgba(214, 51, 132, 0.4); transition: all 0.3s ease; text-transform: uppercase;">
                              ✨ Register & RSVP ✨
                            </a>
                          </td>
                        </tr>
                        <!-- Alternative link -->
                        <tr>
                          <td style="padding: 0 30px 30px;">
                            <div style="background-color: #f8f9fa; padding: 20px; border-radius: 10px; border-left: 4px solid #d63384;">
                              <p style="margin: 0 0 10px; color: #666666; font-size: 14px; font-weight: 600;">Or copy and paste this link:</p>
                              <p style="margin: 0; word-break: break-all; color: #0066cc; font-size: 13px; line-height: 1.6; font-family: monospace;">{invitation_link}</p>
                            </div>
                          </td>
                        </tr>
                        <!-- Closing message -->
                        <tr>
                          <td style="padding: 0 30px 40px; text-align: center;">
                            <p style="margin: 0 0 15px; color: #333333; font-size: 18px; font-weight: 600;">We can't wait to celebrate with you! 🎊</p>
                            <p style="margin: 0; color: #666666; font-size: 16px;">Looking forward to sharing this beautiful moment together.</p>
                          </td>
                        </tr>
                        <!-- Footer -->
                        <tr>
                          <td style="padding: 30px; border-top: 2px solid #f0f0f0; text-align: center; background: linear-gradient(135deg, #fafafa 0%, #f5f5f5 100%);">
                            <p style="margin: 0 0 10px; color: #666666; font-size: 16px; font-style: italic;">With love and joy,</p>
                            <p style="margin: 0; color: #d63384; font-size: 20px; font-weight: 700; letter-spacing: 1px;">💕 The Happy Couple 💕</p>
                            <div style="margin-top: 20px; font-size: 24px; letter-spacing: 5px;">✨ 🎉 💐 🎊 ✨</div>
                          </td>
                        </tr>
                      </table>
                    </td>
                  </tr>
                </table>
              </body>
            </html>
            """
            
            # Plain text version
            text_body = f"""
            You're Invited!
            
            Dear {guest_name or 'Guest'},
            
            We're thrilled to invite you to celebrate our special day with us!
            
            Please visit the following link to register and RSVP:
            {invitation_link}
            
            We can't wait to celebrate with you!
            
            With love,
            The Happy Couple
            """
            
            # Attach both versions (plain text first, then HTML)
            # Some email clients prefer HTML if both are present
            msg.attach(MIMEText(text_body, 'plain', 'utf-8'))
            html_part = MIMEText(html_body, 'html', 'utf-8')
            html_part.set_charset('utf-8')
            msg.attach(html_part)
            
            # Send email
            with smtplib.SMTP(smtp_host, smtp_port) as server:
                server.starttls()
                server.login(smtp_user, smtp_password)
                server.send_message(msg)
            
            return True
        except Exception as e:
            print(f"Error sending email to {email}: {str(e)}")
            return False
    
    @staticmethod
    def send_notification_email(email, subject, message, frontend_url=None):
        """Send a general notification email"""
        try:
            smtp_host = os.getenv('SMTP_HOST', 'smtp.gmail.com')
            smtp_port = int(os.getenv('SMTP_PORT', '587'))
            smtp_user = os.getenv('SMTP_USER')
            smtp_password = os.getenv('SMTP_PASSWORD')
            from_email = os.getenv('SMTP_FROM_EMAIL', smtp_user)
            
            if not smtp_user or not smtp_password:
                print(f"SMTP not configured. Would send notification to {email}")
                return False
            
            msg = MIMEMultipart('alternative')
            msg['Subject'] = subject
            msg['From'] = from_email
            msg['To'] = email
            
            html_body = f"""
            <html>
              <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
                <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
                  {message}
                </div>
              </body>
            </html>
            """
            
            msg.attach(MIMEText(message, 'plain'))
            msg.attach(MIMEText(html_body, 'html'))
            
            with smtplib.SMTP(smtp_host, smtp_port) as server:
                server.starttls()
                server.login(smtp_user, smtp_password)
                server.send_message(msg)
            
            return True
        except Exception as e:
            print(f"Error sending notification email: {str(e)}")
            return False

