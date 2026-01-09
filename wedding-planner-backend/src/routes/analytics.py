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

