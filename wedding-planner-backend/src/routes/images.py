from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
from src.models import db, Image, User
from sqlalchemy.exc import IntegrityError

images_bp = Blueprint('images', __name__)

@images_bp.route('/api/images', methods=['GET'])
def get_images():
    """Get all images (public images for guests, all for admins)"""
    # Check if user is authenticated (admin)
    auth_header = request.headers.get('Authorization')
    is_admin = False
    
    if auth_header and auth_header.startswith('Bearer '):
        try:
            from flask_jwt_extended import decode_token
            token = auth_header.split(' ')[1]
            decoded = decode_token(token)
            user_id = decoded.get('sub')
            user = User.query.get(user_id)
            is_admin = user and user.role == 'admin'
        except:
            pass
    
    if is_admin:
        # Admins see all images
        images = Image.query.order_by(Image.order, Image.created_at.desc()).all()
    else:
        # Guests see only public, active images
        images = Image.query.filter_by(is_public=True, is_active=True).order_by(Image.order, Image.created_at.desc()).all()
    
    return jsonify([img.to_dict() for img in images]), 200

@images_bp.route('/api/images/<int:image_id>', methods=['GET'])
def get_image(image_id):
    """Get a specific image"""
    image = Image.query.get_or_404(image_id)
    
    # Check if user can access this image
    auth_header = request.headers.get('Authorization')
    is_admin = False
    
    if auth_header and auth_header.startswith('Bearer '):
        try:
            from flask_jwt_extended import decode_token
            token = auth_header.split(' ')[1]
            decoded = decode_token(token)
            user_id = decoded.get('sub')
            user = User.query.get(user_id)
            is_admin = user and user.role == 'admin'
        except:
            pass
    
    if not is_admin and (not image.is_public or not image.is_active):
        return jsonify({'error': 'Image not found'}), 404
    
    return jsonify(image.to_dict()), 200

@images_bp.route('/api/images', methods=['POST'])
@jwt_required()
def create_image():
    """Create a new image (admin only)"""
    user_id = get_jwt_identity()
    user = User.query.get(user_id)
    
    if not user or user.role != 'admin':
        return jsonify({'error': 'Unauthorized'}), 403
    
    data = request.get_json()
    
    required_fields = ['name', 'url']
    for field in required_fields:
        if field not in data:
            return jsonify({'error': f'Missing required field: {field}'}), 400
    
    image = Image(
        user_id=user_id,
        name=data['name'],
        url=data['url'],
        alt_text=data.get('alt_text', ''),
        description=data.get('description', ''),
        category=data.get('category', 'gallery'),
        position=data.get('position', ''),
        order=data.get('order', 0),
        is_active=data.get('is_active', True),
        is_public=data.get('is_public', True),
        file_size=data.get('file_size'),
        width=data.get('width'),
        height=data.get('height')
    )
    
    try:
        db.session.add(image)
        db.session.commit()
        return jsonify(image.to_dict()), 201
    except IntegrityError:
        db.session.rollback()
        return jsonify({'error': 'Failed to create image'}), 500

@images_bp.route('/api/images/<int:image_id>', methods=['PUT'])
@jwt_required()
def update_image(image_id):
    """Update an image (admin only)"""
    user_id = get_jwt_identity()
    user = User.query.get(user_id)
    
    if not user or user.role != 'admin':
        return jsonify({'error': 'Unauthorized'}), 403
    
    image = Image.query.get_or_404(image_id)
    data = request.get_json()
    
    # Update fields
    if 'name' in data:
        image.name = data['name']
    if 'url' in data:
        image.url = data['url']
    if 'alt_text' in data:
        image.alt_text = data['alt_text']
    if 'description' in data:
        image.description = data['description']
    if 'category' in data:
        image.category = data['category']
    if 'position' in data:
        image.position = data['position']
    if 'order' in data:
        image.order = data['order']
    if 'is_active' in data:
        image.is_active = data['is_active']
    if 'is_public' in data:
        image.is_public = data['is_public']
    if 'file_size' in data:
        image.file_size = data['file_size']
    if 'width' in data:
        image.width = data['width']
    if 'height' in data:
        image.height = data['height']
    
    try:
        db.session.commit()
        return jsonify(image.to_dict()), 200
    except IntegrityError:
        db.session.rollback()
        return jsonify({'error': 'Failed to update image'}), 500

@images_bp.route('/api/images/<int:image_id>', methods=['DELETE'])
@jwt_required()
def delete_image(image_id):
    """Delete an image (admin only)"""
    user_id = get_jwt_identity()
    user = User.query.get(user_id)
    
    if not user or user.role != 'admin':
        return jsonify({'error': 'Unauthorized'}), 403
    
    image = Image.query.get_or_404(image_id)
    
    try:
        db.session.delete(image)
        db.session.commit()
        return jsonify({'message': 'Image deleted successfully'}), 200
    except IntegrityError:
        db.session.rollback()
        return jsonify({'error': 'Failed to delete image'}), 500

@images_bp.route('/api/images/by-position/<position>', methods=['GET'])
def get_images_by_position(position):
    """Get images by position (e.g., hero, photo1, etc.)"""
    images = Image.query.filter_by(
        position=position,
        is_active=True,
        is_public=True
    ).order_by(Image.order).all()
    
    return jsonify([img.to_dict() for img in images]), 200

