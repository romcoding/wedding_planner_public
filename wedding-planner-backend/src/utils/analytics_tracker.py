"""
Utility functions for tracking analytics and security events
"""
from flask import request
from models import db, PageView, Visit, SecurityEvent
from datetime import datetime
import secrets

def get_client_ip():
    """Get client IP address from request"""
    if request.headers.get('X-Forwarded-For'):
        return request.headers.get('X-Forwarded-For').split(',')[0].strip()
    elif request.headers.get('X-Real-IP'):
        return request.headers.get('X-Real-IP')
    else:
        return request.remote_addr

def track_page_view(page_path, page_title=None, user_id=None, guest_id=None, session_id=None):
    """Track a page view"""
    try:
        ip_address = get_client_ip()
        user_agent = request.headers.get('User-Agent', '')
        referrer = request.headers.get('Referer', '')
        
        page_view = PageView(
            user_id=user_id,
            guest_id=guest_id,
            page_path=page_path,
            page_title=page_title,
            referrer=referrer,
            user_agent=user_agent,
            ip_address=ip_address,
            session_id=session_id,
            is_guest=bool(guest_id)
        )
        
        db.session.add(page_view)
        
        # Update visit page count
        if session_id:
            visit = Visit.query.filter_by(session_id=session_id).first()
            if visit:
                visit.page_count = (visit.page_count or 0) + 1
        
        db.session.commit()
        return page_view
    except Exception as e:
        print(f"Error tracking page view: {e}")
        db.session.rollback()
        return None

def start_visit(user_id=None, guest_id=None, session_id=None):
    """Start a new visit/session"""
    try:
        if not session_id:
            session_id = secrets.token_urlsafe(32)
        
        # Check if visit already exists
        existing_visit = Visit.query.filter_by(session_id=session_id).first()
        if existing_visit:
            return existing_visit
        
        ip_address = get_client_ip()
        user_agent = request.headers.get('User-Agent', '')
        referrer = request.headers.get('Referer', '')
        
        visit = Visit(
            user_id=user_id,
            guest_id=guest_id,
            session_id=session_id,
            ip_address=ip_address,
            user_agent=user_agent,
            referrer=referrer,
            is_guest=bool(guest_id)
        )
        
        db.session.add(visit)
        db.session.commit()
        return visit
    except Exception as e:
        print(f"Error starting visit: {e}")
        db.session.rollback()
        return None

def end_visit(session_id):
    """End a visit/session"""
    try:
        visit = Visit.query.filter_by(session_id=session_id).first()
        if visit and not visit.ended_at:
            visit.end_session()
            db.session.commit()
        return visit
    except Exception as e:
        print(f"Error ending visit: {e}")
        db.session.rollback()
        return None

def track_security_event(event_type, ip_address=None, user_id=None, details=None, severity='medium'):
    """Track a security event"""
    try:
        if not ip_address:
            ip_address = get_client_ip()
        
        user_agent = request.headers.get('User-Agent', '')
        
        details_json = None
        if details:
            import json
            if isinstance(details, dict):
                details_json = json.dumps(details)
            else:
                details_json = str(details)
        
        security_event = SecurityEvent(
            user_id=user_id,
            event_type=event_type,
            ip_address=ip_address,
            user_agent=user_agent,
            details=details_json,
            severity=severity
        )
        
        db.session.add(security_event)
        db.session.commit()
        return security_event
    except Exception as e:
        print(f"Error tracking security event: {e}")
        db.session.rollback()
        return None
