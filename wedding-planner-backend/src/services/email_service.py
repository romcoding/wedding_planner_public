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
            
            # Create rich HTML email template
            html_body = f"""
            <!DOCTYPE html>
            <html>
              <head>
                <meta charset="utf-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <style>
                  @media only screen and (max-width: 600px) {{
                    .container {{ width: 100% !important; padding: 10px !important; }}
                    .button {{ padding: 12px 24px !important; font-size: 16px !important; }}
                    h1 {{ font-size: 32px !important; }}
                  }}
                </style>
              </head>
              <body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f5f5f5; line-height: 1.6;">
                <table role="presentation" style="width: 100%; border-collapse: collapse; background-color: #f5f5f5; padding: 20px 0;">
                  <tr>
                    <td align="center" style="padding: 20px 0;">
                      <table role="presentation" class="container" style="max-width: 600px; width: 100%; background-color: #ffffff; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); margin: 0 auto;">
                        <tr>
                          <td style="padding: 40px 30px; text-align: center; background: linear-gradient(135deg, #fce7f3 0%, #f3e8ff 100%); border-radius: 8px 8px 0 0;">
                            <h1 style="margin: 0; color: #d63384; font-size: 42px; font-weight: bold; letter-spacing: -0.5px;">You're Invited!</h1>
                          </td>
                        </tr>
                        <tr>
                          <td style="padding: 30px 30px 20px;">
                            <p style="margin: 0 0 20px; color: #333333; font-size: 16px; font-weight: 500;">Dear {guest_name or 'Guest'},</p>
                            <p style="margin: 0 0 20px; color: #333333; font-size: 16px;">We're thrilled to invite you to celebrate our special day with us!</p>
                            <p style="margin: 0 0 30px; color: #333333; font-size: 16px;">Please click the link below to register and RSVP:</p>
                          </td>
                        </tr>
                        <tr>
                          <td align="center" style="padding: 0 30px 30px;">
                            <a href="{invitation_link}" 
                               class="button"
                               style="background-color: #d63384; color: #ffffff; padding: 15px 40px; text-decoration: none; border-radius: 6px; display: inline-block; font-weight: 600; font-size: 18px; letter-spacing: 0.5px; box-shadow: 0 4px 6px rgba(214, 51, 132, 0.3); transition: all 0.3s ease;">
                              Register & RSVP
                            </a>
                          </td>
                        </tr>
                        <tr>
                          <td style="padding: 0 30px 30px;">
                            <p style="margin: 0 0 10px; color: #666666; font-size: 14px;">Or copy and paste this link into your browser:</p>
                            <p style="margin: 0; word-break: break-all; color: #0066cc; font-size: 14px; line-height: 1.8;">{invitation_link}</p>
                          </td>
                        </tr>
                        <tr>
                          <td style="padding: 0 30px 40px;">
                            <p style="margin: 0; color: #333333; font-size: 16px;">We can't wait to celebrate with you!</p>
                          </td>
                        </tr>
                        <tr>
                          <td style="padding: 30px; border-top: 1px solid #eeeeee; text-align: center; background-color: #fafafa;">
                            <p style="margin: 0; color: #666666; font-size: 14px;">
                              With love,<br>
                              <span style="font-weight: 600; color: #333333; margin-top: 5px; display: inline-block;">The Happy Couple</span>
                            </p>
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

