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
            
            # Create message
            msg = MIMEMultipart('alternative')
            msg['Subject'] = "You're Invited to Our Wedding!"
            msg['From'] = from_email
            msg['To'] = email
            
            # Create invitation link
            invitation_link = f"{frontend_url}/register?token={invitation_token}"
            
            # Create HTML email
            html_body = f"""
            <html>
              <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
                <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
                  <h1 style="color: #d63384;">You're Invited!</h1>
                  <p>Dear {guest_name or 'Guest'},</p>
                  <p>We're thrilled to invite you to celebrate our special day with us!</p>
                  <p>Please click the link below to register and RSVP:</p>
                  <p style="text-align: center; margin: 30px 0;">
                    <a href="{invitation_link}" 
                       style="background-color: #d63384; color: white; padding: 15px 30px; 
                              text-decoration: none; border-radius: 5px; display: inline-block;">
                      Register & RSVP
                    </a>
                  </p>
                  <p>Or copy and paste this link into your browser:</p>
                  <p style="word-break: break-all; color: #666;">{invitation_link}</p>
                  <p>We can't wait to celebrate with you!</p>
                  <p style="margin-top: 40px; color: #666; font-size: 14px;">
                    With love,<br>
                    The Happy Couple
                  </p>
                </div>
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
            
            # Attach both versions
            msg.attach(MIMEText(text_body, 'plain'))
            msg.attach(MIMEText(html_body, 'html'))
            
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

