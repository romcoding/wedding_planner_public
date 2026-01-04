from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
from src.models import db, Content, User
from src.utils.jwt_helpers import get_admin_id

content_bp = Blueprint('content', __name__)

@content_bp.route('', methods=['GET'])
def get_content():
    """Get public content (no auth required) or all content (admin)"""
    is_public_only = not request.args.get('admin', '').lower() == 'true'
    
    if is_public_only:
        # Public endpoint - only return public content
        contents = Content.query.filter_by(is_public=True).order_by(Content.order.asc()).all()
    else:
        # Check if user is authenticated for admin access
        try:
            from flask_jwt_extended import verify_jwt_in_request
            verify_jwt_in_request()
            user_id = get_admin_id()
            
            if not user_id:
                return jsonify({'error': 'Unauthorized - Admin access required'}), 401
            
            user = User.query.get(user_id)
            
            if not user or user.role != 'admin':
                return jsonify({'error': 'Unauthorized'}), 401
            
            # Return all content for admin
            contents = Content.query.order_by(Content.order.asc()).all()
        except:
            return jsonify({'error': 'Unauthorized'}), 401
    
    return jsonify([content.to_dict() for content in contents]), 200

@content_bp.route('/<string:key>', methods=['GET'])
def get_content_by_key(key):
    """Get specific content by key"""
    content = Content.query.filter_by(key=key).first()
    
    if not content:
        return jsonify({'error': 'Content not found'}), 404
    
    # Check if content is public or user is admin
    if not content.is_public:
        try:
            from flask_jwt_extended import verify_jwt_in_request
            verify_jwt_in_request()
            user_id = get_admin_id()
            
            if not user_id:
                return jsonify({'error': 'Unauthorized - Admin access required'}), 401
            
            user = User.query.get(user_id)
            
            if not user or user.role != 'admin':
                return jsonify({'error': 'Unauthorized'}), 401
        except:
            return jsonify({'error': 'Unauthorized'}), 401
    
    return jsonify(content.to_dict()), 200

@content_bp.route('', methods=['POST'])
@jwt_required()
def create_content():
    """Create new content (admin only)"""
    user_id = get_admin_id()
    
    if not user_id:
        return jsonify({'error': 'Unauthorized - Admin access required'}), 403
    
    user = User.query.get(user_id)
    
    if not user:
        return jsonify({'error': 'User not found'}), 404
    
    data = request.get_json()
    
    if not data or not data.get('key') or not data.get('content'):
        return jsonify({'error': 'Key and content are required'}), 400
    
    if Content.query.filter_by(key=data['key']).first():
        return jsonify({'error': 'Content with this key already exists'}), 400
    
    content = Content(
        key=data['key'],
        title=data.get('title'),
        content=data['content'],
        content_type=data.get('content_type', 'text'),
        is_public=data.get('is_public', True),
        order=data.get('order', 0)
    )
    
    db.session.add(content)
    db.session.commit()
    
    return jsonify(content.to_dict()), 201

@content_bp.route('/<int:content_id>', methods=['PUT'])
@jwt_required()
def update_content(content_id):
    """Update content (admin only)"""
    user_id = get_admin_id()
    
    if not user_id:
        return jsonify({'error': 'Unauthorized - Admin access required'}), 403
    
    user = User.query.get(user_id)
    
    if not user:
        return jsonify({'error': 'User not found'}), 404
    
    content = Content.query.get(content_id)
    
    if not content:
        return jsonify({'error': 'Content not found'}), 404
    
    data = request.get_json()
    
    if 'key' in data:
        # Check if new key already exists
        existing = Content.query.filter_by(key=data['key']).filter(Content.id != content_id).first()
        if existing:
            return jsonify({'error': 'Content with this key already exists'}), 400
        content.key = data['key']
    if 'title' in data:
        content.title = data['title']
    if 'content' in data:
        content.content = data['content']
    if 'content_type' in data:
        content.content_type = data['content_type']
    if 'is_public' in data:
        content.is_public = data['is_public']
    if 'order' in data:
        content.order = data['order']
    
    from datetime import datetime
    content.updated_at = datetime.utcnow()
    db.session.commit()
    
    return jsonify(content.to_dict()), 200

@content_bp.route('/<int:content_id>', methods=['DELETE'])
@jwt_required()
def delete_content(content_id):
    """Delete content (admin only)"""
    user_id = get_admin_id()
    
    if not user_id:
        return jsonify({'error': 'Unauthorized - Admin access required'}), 403
    
    user = User.query.get(user_id)
    
    if not user:
        return jsonify({'error': 'User not found'}), 404
    
    content = Content.query.get(content_id)
    
    if not content:
        return jsonify({'error': 'Content not found'}), 404
    
    db.session.delete(content)
    db.session.commit()
    
    return jsonify({'message': 'Content deleted successfully'}), 200

