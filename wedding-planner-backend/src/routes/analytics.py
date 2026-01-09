from flask import Blueprint, jsonify, request
from flask_jwt_extended import jwt_required, get_jwt_identity
from src.models import db, Guest, Task, Cost, User, PageView, Visit, SecurityEvent
from src.utils.jwt_helpers import get_admin_id
from sqlalchemy import func
from datetime import datetime, timedelta

analytics_bp = Blueprint('analytics', __name__)

@analytics_bp.route('/overview', methods=['GET'])
@jwt_required()
def get_overview():
    """Get registration overview statistics"""
    user_id = get_jwt_identity()
    # Convert to int if it's a string (JWT identity is now a string)
    user_id = int(user_id) if isinstance(user_id, str) and not str(user_id).startswith('guest_') else user_id
    user = User.query.get(user_id)
    
    if not user:
        return jsonify({'error': 'User not found'}), 404
    
    # Guest statistics
    total_guests = Guest.query.count()
    confirmed_guests = Guest.query.filter_by(rsvp_status='confirmed').count()
    pending_guests = Guest.query.filter_by(rsvp_status='pending').count()
    declined_guests = Guest.query.filter_by(rsvp_status='declined').count()
    
    # Total attendance count (including plus-ones)
    total_attendance = db.session.query(func.sum(Guest.number_of_guests)).filter_by(rsvp_status='confirmed').scalar() or 0
    
    # Overnight stay breakdown
    overnight_stay_count = Guest.query.filter_by(overnight_stay=True, rsvp_status='confirmed').count()
    no_overnight_stay_count = Guest.query.filter_by(overnight_stay=False, rsvp_status='confirmed').count()
    
    return jsonify({
        'guests': {
            'total': total_guests,
            'confirmed': confirmed_guests,
            'pending': pending_guests,
            'declined': declined_guests,
            'total_attendance': int(total_attendance),
            'attendance_breakdown': {
                'overnight_stay': overnight_stay_count,
                'no_overnight_stay': no_overnight_stay_count
            }
        }
    }), 200

@analytics_bp.route('/dietary', methods=['GET'])
@jwt_required()
def get_dietary():
    """Get dietary requirements summary"""
    user_id = get_jwt_identity()
    # Convert to int if it's a string (JWT identity is now a string)
    user_id = int(user_id) if isinstance(user_id, str) and not str(user_id).startswith('guest_') else user_id
    user = User.query.get(user_id)
    
    if not user:
        return jsonify({'error': 'User not found'}), 404
    
    # Count guests with dietary restrictions
    guests_with_restrictions = Guest.query.filter(
        Guest.dietary_restrictions.isnot(None),
        Guest.dietary_restrictions != ''
    ).count()
    
    guests_with_allergies = Guest.query.filter(
        Guest.allergies.isnot(None),
        Guest.allergies != ''
    ).count()
    
    guests_with_special_requests = Guest.query.filter(
        Guest.special_requests.isnot(None),
        Guest.special_requests != ''
    ).count()
    
    # Get all dietary restrictions (simplified - in production, you'd parse JSON)
    all_restrictions = []
    all_allergies = []
    
    guests = Guest.query.filter(
        Guest.dietary_restrictions.isnot(None),
        Guest.dietary_restrictions != ''
    ).all()
    
    for guest in guests:
        if guest.dietary_restrictions:
            all_restrictions.append(guest.dietary_restrictions)
        if guest.allergies:
            all_allergies.append(guest.allergies)
    
    return jsonify({
        'summary': {
            'guests_with_restrictions': guests_with_restrictions,
            'guests_with_allergies': guests_with_allergies,
            'guests_with_special_requests': guests_with_special_requests
        },
        'details': {
            'restrictions': all_restrictions,
            'allergies': all_allergies
        }
    }), 200

@analytics_bp.route('/attendance', methods=['GET'])
@jwt_required()
def get_attendance():
    """Get detailed attendance statistics"""
    user_id = get_jwt_identity()
    # Convert to int if it's a string (JWT identity is now a string)
    user_id = int(user_id) if isinstance(user_id, str) and not str(user_id).startswith('guest_') else user_id
    user = User.query.get(user_id)
    
    if not user:
        return jsonify({'error': 'User not found'}), 404
    
    # RSVP status breakdown
    rsvp_breakdown = db.session.query(
        Guest.rsvp_status,
        func.count(Guest.id).label('count')
    ).group_by(Guest.rsvp_status).all()
    
    # Overnight stay breakdown
    overnight_breakdown = db.session.query(
        Guest.overnight_stay,
        func.count(Guest.id).label('count')
    ).filter_by(rsvp_status='confirmed').group_by(Guest.overnight_stay).all()
    
    # Recent registrations (last 7 days)
    from datetime import datetime, timedelta
    seven_days_ago = datetime.utcnow() - timedelta(days=7)
    recent_registrations = Guest.query.filter(
        Guest.registered_at >= seven_days_ago
    ).count()
    
    return jsonify({
        'rsvp_breakdown': {status: count for status, count in rsvp_breakdown},
        'overnight_breakdown': {str(overnight): count for overnight, count in overnight_breakdown},
        'recent_registrations': recent_registrations
    }), 200

@analytics_bp.route('/budget', methods=['GET'])
@jwt_required()
def get_budget():
    """Get budget and cost analytics"""
    user_id = get_jwt_identity()
    # Convert to int if it's a string (JWT identity is now a string)
    user_id = int(user_id) if isinstance(user_id, str) and not str(user_id).startswith('guest_') else user_id
    user = User.query.get(user_id)
    
    if not user:
        return jsonify({'error': 'User not found'}), 404
    
    # Cost statistics
    total_planned = db.session.query(func.sum(Cost.amount)).filter_by(status='planned', user_id=user_id).scalar() or 0
    total_paid = db.session.query(func.sum(Cost.amount)).filter_by(status='paid', user_id=user_id).scalar() or 0
    total_pending = db.session.query(func.sum(Cost.amount)).filter_by(status='pending', user_id=user_id).scalar() or 0
    
    # Cost by category
    cost_by_category = db.session.query(
        Cost.category,
        func.sum(Cost.amount).label('total')
    ).filter_by(user_id=user_id).group_by(Cost.category).all()
    
    # Task statistics
    total_tasks = Task.query.filter_by(user_id=user_id).count()
    completed_tasks = Task.query.filter_by(user_id=user_id, status='completed').count()
    in_progress_tasks = Task.query.filter_by(user_id=user_id, status='in_progress').count()
    
    return jsonify({
        'costs': {
            'total_planned': float(total_planned),
            'total_paid': float(total_paid),
            'total_pending': float(total_pending),
            'by_category': {category: float(total) for category, total in cost_by_category}
        },
        'tasks': {
            'total': total_tasks,
            'completed': completed_tasks,
            'in_progress': in_progress_tasks,
            'completion_rate': (completed_tasks / total_tasks * 100) if total_tasks > 0 else 0
        }
    }), 200

@analytics_bp.route('/site-stats', methods=['GET'])
@jwt_required()
def get_site_stats():
    """Get real site statistics (admin only)"""
    user_id = get_admin_id()
    
    if not user_id:
        return jsonify({'error': 'Unauthorized - Admin access required'}), 403
    
    # Time range (default: last 30 days)
    days = int(request.args.get('days', 30))
    start_date = datetime.utcnow() - timedelta(days=days)
    
    # Total visits
    total_visits = Visit.query.filter(Visit.started_at >= start_date).count()
    
    # Unique visitors (by IP or session)
    unique_visitors = db.session.query(func.count(func.distinct(Visit.ip_address))).filter(
        Visit.started_at >= start_date
    ).scalar() or 0
    
    # Total page views
    total_page_views = PageView.query.filter(PageView.viewed_at >= start_date).count()
    
    # Average session duration
    completed_visits = Visit.query.filter(
        Visit.started_at >= start_date,
        Visit.ended_at.isnot(None),
        Visit.duration_seconds.isnot(None)
    ).all()
    
    avg_duration = 0
    if completed_visits:
        total_duration = sum(v.duration_seconds or 0 for v in completed_visits)
        avg_duration = total_duration / len(completed_visits)
    
    # Bounce rate (sessions with only 1 page view)
    single_page_visits = Visit.query.filter(
        Visit.started_at >= start_date,
        Visit.page_count == 1
    ).count()
    bounce_rate = (single_page_visits / total_visits * 100) if total_visits > 0 else 0
    
    # Page views by path
    page_views_by_path = db.session.query(
        PageView.page_path,
        func.count(PageView.id).label('count')
    ).filter(
        PageView.viewed_at >= start_date
    ).group_by(PageView.page_path).order_by(func.count(PageView.id).desc()).limit(10).all()
    
    # Visits over time (daily)
    daily_visits = db.session.query(
        func.date(Visit.started_at).label('date'),
        func.count(Visit.id).label('count')
    ).filter(
        Visit.started_at >= start_date
    ).group_by(func.date(Visit.started_at)).order_by(func.date(Visit.started_at)).all()
    
    return jsonify({
        'total_visits': total_visits,
        'unique_visitors': unique_visitors,
        'page_views': total_page_views,
        'avg_session_duration': int(avg_duration),
        'bounce_rate': round(bounce_rate, 2),
        'top_pages': [{'path': path, 'views': count} for path, count in page_views_by_path],
        'daily_visits': [{'date': date.isoformat() if hasattr(date, 'isoformat') else str(date), 'count': count} for date, count in daily_visits]
    }), 200

@analytics_bp.route('/security', methods=['GET'])
@jwt_required()
def get_security_events():
    """Get security monitoring data (admin only)"""
    user_id = get_admin_id()
    
    if not user_id:
        return jsonify({'error': 'Unauthorized - Admin access required'}), 403
    
    # Time range (default: last 7 days)
    days = int(request.args.get('days', 7))
    start_date = datetime.utcnow() - timedelta(days=days)
    
    # Failed login attempts
    failed_logins = SecurityEvent.query.filter(
        SecurityEvent.event_type == 'failed_login',
        SecurityEvent.occurred_at >= start_date
    ).count()
    
    # Blocked requests
    blocked_requests = SecurityEvent.query.filter(
        SecurityEvent.event_type == 'blocked_request',
        SecurityEvent.occurred_at >= start_date
    ).count()
    
    # Rate limit hits
    rate_limit_hits = SecurityEvent.query.filter(
        SecurityEvent.event_type == 'rate_limit',
        SecurityEvent.occurred_at >= start_date
    ).count()
    
    # Suspicious IPs (IPs with multiple failed logins)
    suspicious_ips_query = db.session.query(
        SecurityEvent.ip_address,
        func.count(SecurityEvent.id).label('count')
    ).filter(
        SecurityEvent.event_type == 'failed_login',
        SecurityEvent.occurred_at >= start_date
    ).group_by(SecurityEvent.ip_address).having(
        func.count(SecurityEvent.id) >= 3
    ).order_by(func.count(SecurityEvent.id).desc()).limit(10).all()
    
    suspicious_ips = [ip for ip, count in suspicious_ips_query]
    
    # Recent security events
    recent_events = SecurityEvent.query.filter(
        SecurityEvent.occurred_at >= start_date
    ).order_by(SecurityEvent.occurred_at.desc()).limit(50).all()
    
    # Events by type
    events_by_type = db.session.query(
        SecurityEvent.event_type,
        func.count(SecurityEvent.id).label('count')
    ).filter(
        SecurityEvent.occurred_at >= start_date
    ).group_by(SecurityEvent.event_type).all()
    
    return jsonify({
        'failed_logins': failed_logins,
        'blocked_requests': blocked_requests,
        'rate_limit_hits': rate_limit_hits,
        'suspicious_ips': suspicious_ips,
        'events_by_type': {event_type: count for event_type, count in events_by_type},
        'recent_events': [event.to_dict() for event in recent_events]
    }), 200

@analytics_bp.route('/track/pageview', methods=['POST', 'OPTIONS'])
def track_pageview():
    """Track a page view (public endpoint, can be called from frontend)"""
    if request.method == 'OPTIONS':
        return jsonify({}), 200
    
    data = request.get_json() or {}
    
    page_path = data.get('page_path', request.path)
    page_title = data.get('page_title')
    session_id = data.get('session_id')
    user_id = data.get('user_id')
    guest_id = data.get('guest_id')
    
    from src.utils.analytics_tracker import track_page_view
    track_page_view(
        page_path=page_path,
        page_title=page_title,
        user_id=user_id,
        guest_id=guest_id,
        session_id=session_id
    )
    
    return jsonify({'message': 'Page view tracked'}), 200

@analytics_bp.route('/track/visit/start', methods=['POST', 'OPTIONS'])
def start_visit_tracking():
    """Start tracking a visit (public endpoint)"""
    if request.method == 'OPTIONS':
        return jsonify({}), 200
    
    data = request.get_json() or {}
    
    session_id = data.get('session_id')
    user_id = data.get('user_id')
    guest_id = data.get('guest_id')
    
    from src.utils.analytics_tracker import start_visit
    visit = start_visit(
        user_id=user_id,
        guest_id=guest_id,
        session_id=session_id
    )
    
    if visit:
        return jsonify({
            'message': 'Visit started',
            'session_id': visit.session_id
        }), 200
    else:
        return jsonify({'error': 'Failed to start visit'}), 500

@analytics_bp.route('/track/visit/end', methods=['POST', 'OPTIONS'])
def end_visit_tracking():
    """End tracking a visit (public endpoint)"""
    if request.method == 'OPTIONS':
        return jsonify({}), 200
    
    data = request.get_json() or {}
    
    session_id = data.get('session_id')
    if not session_id:
        return jsonify({'error': 'session_id is required'}), 400
    
    from src.utils.analytics_tracker import end_visit
    visit = end_visit(session_id)
    
    if visit:
        return jsonify({'message': 'Visit ended'}), 200
    else:
        return jsonify({'error': 'Visit not found'}), 404
