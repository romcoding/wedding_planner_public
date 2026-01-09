from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
from src.models import db, Cost, User
from datetime import datetime

costs_bp = Blueprint('costs', __name__)

@costs_bp.route('', methods=['GET'])
@jwt_required()
def get_costs():
    """Get all costs for the current user"""
    user_id = get_jwt_identity()
    user = User.query.get(user_id)
    
    if not user:
        return jsonify({'error': 'User not found'}), 404
    
    # Filtering options
    category = request.args.get('category')
    status = request.args.get('status')
    
    query = Cost.query.filter_by(user_id=user_id)
    
    if category:
        query = query.filter_by(category=category)
    if status:
        query = query.filter_by(status=status)
    
    costs = query.order_by(Cost.created_at.desc()).all()
    
    return jsonify([cost.to_dict() for cost in costs]), 200

@costs_bp.route('', methods=['POST'])
@jwt_required()
def create_cost():
    """Create a new cost item"""
    user_id = get_jwt_identity()
    user = User.query.get(user_id)
    
    if not user:
        return jsonify({'error': 'User not found'}), 404
    
    data = request.get_json()
    
    if not data or not data.get('name') or not data.get('amount'):
        return jsonify({'error': 'Name and amount are required'}), 400
    
    payment_date = None
    if data.get('payment_date'):
        try:
            payment_date = datetime.strptime(data['payment_date'], '%Y-%m-%d').date()
        except ValueError:
            return jsonify({'error': 'Invalid date format. Use YYYY-MM-DD'}), 400
    
    cost = Cost(
        user_id=user_id,
        name=data['name'],
        description=data.get('description'),
        category=data.get('category', 'other'),
        amount=data['amount'],
        status=data.get('status', 'planned'),
        payment_date=payment_date,
        vendor_name=data.get('vendor_name') or data.get('vendor'),  # Support both
        vendor_contact=data.get('vendor_contact'),
        receipt_url=data.get('receipt_url'),
        vendor=data.get('vendor'),  # Keep for backward compatibility
        notes=data.get('notes')
    )
    
    db.session.add(cost)
    db.session.commit()
    
    return jsonify(cost.to_dict()), 201

@costs_bp.route('/<int:cost_id>', methods=['PUT'])
@jwt_required()
def update_cost(cost_id):
    """Update a cost item"""
    user_id = get_jwt_identity()
    user = User.query.get(user_id)
    
    if not user:
        return jsonify({'error': 'User not found'}), 404
    
    cost = Cost.query.filter_by(id=cost_id, user_id=user_id).first()
    
    if not cost:
        return jsonify({'error': 'Cost not found'}), 404
    
    data = request.get_json()
    
    if 'name' in data:
        cost.name = data['name']
    if 'description' in data:
        cost.description = data['description']
    if 'category' in data:
        cost.category = data['category']
    if 'amount' in data:
        cost.amount = data['amount']
    if 'status' in data:
        cost.status = data['status']
    if 'payment_date' in data:
        if data['payment_date']:
            try:
                cost.payment_date = datetime.strptime(data['payment_date'], '%Y-%m-%d').date()
            except ValueError:
                return jsonify({'error': 'Invalid date format. Use YYYY-MM-DD'}), 400
        else:
            cost.payment_date = None
    if 'vendor' in data:
        cost.vendor = data['vendor']
    if 'vendor_name' in data:
        cost.vendor_name = data['vendor_name']
    if 'vendor_contact' in data:
        cost.vendor_contact = data['vendor_contact']
    if 'receipt_url' in data:
        cost.receipt_url = data['receipt_url']
    if 'notes' in data:
        cost.notes = data['notes']
    
    cost.updated_at = datetime.utcnow()
    db.session.commit()
    
    return jsonify(cost.to_dict()), 200

@costs_bp.route('/<int:cost_id>', methods=['DELETE'])
@jwt_required()
def delete_cost(cost_id):
    """Delete a cost item"""
    user_id = get_jwt_identity()
    user = User.query.get(user_id)
    
    if not user:
        return jsonify({'error': 'User not found'}), 404
    
    cost = Cost.query.filter_by(id=cost_id, user_id=user_id).first()
    
    if not cost:
        return jsonify({'error': 'Cost not found'}), 404
    
    db.session.delete(cost)
    db.session.commit()
    
    return jsonify({'message': 'Cost deleted successfully'}), 200

@costs_bp.route('/analytics', methods=['GET'])
@jwt_required()
def get_cost_analytics():
    """Get cost analytics by category"""
    user_id = get_jwt_identity()
    user = User.query.get(user_id)
    
    if not user:
        return jsonify({'error': 'User not found'}), 404
    
    costs = Cost.query.filter_by(user_id=user_id).all()
    
    # Calculate totals by category and status
    category_totals = {}
    status_totals = {'planned': 0, 'pending': 0, 'paid': 0}
    
    for cost in costs:
        category = cost.category or 'other'
        if category not in category_totals:
            category_totals[category] = {'planned': 0, 'pending': 0, 'paid': 0, 'total': 0}
        
        amount = float(cost.amount)
        category_totals[category][cost.status] += amount
        category_totals[category]['total'] += amount
        status_totals[cost.status] += amount
    
    # Calculate percentages and alerts
    total_planned = status_totals['planned']
    alerts = []
    
    for category, totals in category_totals.items():
        if total_planned > 0:
            planned_for_category = totals['planned']
            spent_for_category = totals['paid'] + totals['pending']
            if planned_for_category > 0:
                percentage = (spent_for_category / planned_for_category) * 100
                if percentage >= 90:
                    alerts.append({
                        'category': category,
                        'percentage': round(percentage, 1),
                        'planned': planned_for_category,
                        'spent': spent_for_category
                    })
    
    return jsonify({
        'by_category': category_totals,
        'by_status': status_totals,
        'total': sum(status_totals.values()),
        'alerts': alerts
    }), 200
