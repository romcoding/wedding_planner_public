from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
from src.models import db, GiftRegistry, User
from sqlalchemy.exc import IntegrityError

gift_registry_bp = Blueprint('gift_registry', __name__)

@gift_registry_bp.route('', methods=['GET'])
def get_gift_registry():
    """Get gift registry items (public items for guests, all for admins)"""
    auth_header = request.headers.get('Authorization')
    is_admin = False
    
    if auth_header and auth_header.startswith('Bearer '):
        try:
            from flask_jwt_extended import decode_token
            token = auth_header.split(' ')[1]
            decoded = decode_token(token)
            user_id = decoded.get('sub')
            if not str(user_id).startswith('guest_'):
                user = User.query.get(user_id)
                is_admin = user and user.role == 'admin'
        except:
            pass
    
    if is_admin:
        items = GiftRegistry.query.filter_by(is_active=True).order_by(GiftRegistry.order).all()
    else:
        items = GiftRegistry.query.filter_by(is_active=True, is_public=True).order_by(GiftRegistry.order).all()
    
    return jsonify([item.to_dict() for item in items]), 200

@gift_registry_bp.route('', methods=['POST'])
@jwt_required()
def create_gift_registry_item():
    """Create gift registry item (admin only)"""
    user_id = get_jwt_identity()
    user = User.query.get(user_id)
    
    if not user or user.role != 'admin':
        return jsonify({'error': 'Unauthorized'}), 403
    
    data = request.get_json()
    
    if not data or not data.get('name') or not data.get('registry_type'):
        return jsonify({'error': 'Name and registry_type are required'}), 400
    
    item = GiftRegistry(
        user_id=user_id,
        name=data['name'],
        description=data.get('description', ''),
        registry_type=data['registry_type'],
        url=data.get('url'),
        target_amount=data.get('target_amount'),
        current_amount=data.get('current_amount', 0),
        is_active=data.get('is_active', True),
        is_public=data.get('is_public', True),
        order=data.get('order', 0)
    )
    
    try:
        db.session.add(item)
        db.session.commit()
        return jsonify(item.to_dict()), 201
    except IntegrityError:
        db.session.rollback()
        return jsonify({'error': 'Failed to create gift registry item'}), 500

@gift_registry_bp.route('/<int:item_id>', methods=['PUT'])
@jwt_required()
def update_gift_registry_item(item_id):
    """Update gift registry item (admin only)"""
    user_id = get_jwt_identity()
    user = User.query.get(user_id)
    
    if not user or user.role != 'admin':
        return jsonify({'error': 'Unauthorized'}), 403
    
    item = GiftRegistry.query.get_or_404(item_id)
    data = request.get_json()
    
    if 'name' in data:
        item.name = data['name']
    if 'description' in data:
        item.description = data['description']
    if 'registry_type' in data:
        item.registry_type = data['registry_type']
    if 'url' in data:
        item.url = data['url']
    if 'target_amount' in data:
        item.target_amount = data['target_amount']
    if 'current_amount' in data:
        item.current_amount = data['current_amount']
    if 'is_active' in data:
        item.is_active = data['is_active']
    if 'is_public' in data:
        item.is_public = data['is_public']
    if 'order' in data:
        item.order = data['order']
    
    try:
        db.session.commit()
        return jsonify(item.to_dict()), 200
    except IntegrityError:
        db.session.rollback()
        return jsonify({'error': 'Failed to update gift registry item'}), 500

@gift_registry_bp.route('/<int:item_id>', methods=['DELETE'])
@jwt_required()
def delete_gift_registry_item(item_id):
    """Delete gift registry item (admin only)"""
    user_id = get_jwt_identity()
    user = User.query.get(user_id)
    
    if not user or user.role != 'admin':
        return jsonify({'error': 'Unauthorized'}), 403
    
    item = GiftRegistry.query.get_or_404(item_id)
    
    try:
        db.session.delete(item)
        db.session.commit()
        return jsonify({'message': 'Gift registry item deleted successfully'}), 200
    except IntegrityError:
        db.session.rollback()
        return jsonify({'error': 'Failed to delete gift registry item'}), 500

