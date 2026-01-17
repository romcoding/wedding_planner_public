from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
from src.models import db, Image, User
from src.utils.jwt_helpers import get_admin_id
from sqlalchemy.exc import IntegrityError
import base64
from io import BytesIO
from PIL import Image as PILImage

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
            identity = decoded.get('sub')
            # Check if it's an admin (integer ID) or guest (guest_X format)
            if identity:
                # If it's a string starting with 'guest_', it's a guest token
                if isinstance(identity, str) and identity.startswith('guest_'):
                    is_admin = False
                else:
                    # Try to get admin ID
                    try:
                        admin_id = int(identity) if isinstance(identity, str) else identity
                        user = User.query.get(admin_id)
                        is_admin = user and user.role == 'admin'
                    except (ValueError, TypeError):
                        pass
        except Exception as e:
            # If token decode fails, treat as guest
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
            identity = decoded.get('sub')
            # Check if it's an admin (integer ID) or guest (guest_X format)
            if identity:
                # If it's a string starting with 'guest_', it's a guest token
                if isinstance(identity, str) and identity.startswith('guest_'):
                    is_admin = False
                else:
                    # Try to get admin ID
                    try:
                        admin_id = int(identity) if isinstance(identity, str) else identity
                        user = User.query.get(admin_id)
                        is_admin = user and user.role == 'admin'
                    except (ValueError, TypeError):
                        pass
        except Exception as e:
            # If token decode fails, treat as guest
            pass
    
    if not is_admin and (not image.is_public or not image.is_active):
        return jsonify({'error': 'Image not found'}), 404
    
    return jsonify(image.to_dict()), 200

@images_bp.route('/api/images', methods=['POST'])
@jwt_required()
def create_image():
    """Create a new image (admin only) - accepts file upload or URL"""
    user_id = get_admin_id()
    
    if not user_id:
        return jsonify({'error': 'Unauthorized - Admin access required'}), 403
    
    user = User.query.get(user_id)
    
    if not user or user.role != 'admin':
        return jsonify({'error': 'Unauthorized'}), 403
    
    # Check content type
    content_type = request.content_type or ''
    
    # Check if this is a file upload (multipart/form-data)
    # Flask's request.files will have the file even if content-type header is slightly different
    if 'file' in request.files:
        file = request.files['file']
        # Only process if file actually exists and has a filename
        if file and file.filename:
            # File upload
            position = request.form.get('position', '')
            
            if not position:
                return jsonify({'error': 'Position is required'}), 400
            
            # Validate file type
            allowed_extensions = {'png', 'jpg', 'jpeg', 'gif', 'webp', 'svg'}
            if not ('.' in file.filename and file.filename.rsplit('.', 1)[1].lower() in allowed_extensions):
                return jsonify({'error': 'Invalid file type. Allowed: PNG, JPG, JPEG, GIF, WEBP, SVG'}), 400
            
            # Read file
            file_data = file.read()
            file_size = len(file_data)
            
            # Validate file size (max 10MB)
            if file_size > 10 * 1024 * 1024:
                return jsonify({'error': 'File size exceeds 10MB limit'}), 400
            
            # Convert to base64
            image_base64 = base64.b64encode(file_data).decode('utf-8')
            mime_type = file.content_type or 'image/jpeg'
            data_url = f'data:{mime_type};base64,{image_base64}'
            
            # Get image dimensions (best-effort; SVG will not be readable by PIL)
            width, height = None, None
            try:
                ext = file.filename.rsplit('.', 1)[1].lower()
                if ext != 'svg':
                    img = PILImage.open(BytesIO(file_data))
                    width, height = img.size
            except Exception:
                width, height = None, None
            
            # Create image record
            image = Image(
                user_id=user_id,
                name=file.filename,
                url=data_url,
                position=position,
                category='gallery',
                is_active=True,
                is_public=True,
                file_size=file_size,
                width=width,
                height=height
            )
            
            try:
                db.session.add(image)
                db.session.commit()
                return jsonify(image.to_dict()), 201
            except IntegrityError as e:
                db.session.rollback()
                return jsonify({'error': f'Failed to create image: {str(e)}'}), 500
            except Exception as e:
                db.session.rollback()
                return jsonify({'error': f'Unexpected error: {str(e)}'}), 500
        else:
            return jsonify({'error': 'No file provided or empty filename'}), 400
    
    # Not a file upload, try JSON
    try:
        data = request.get_json(force=True, silent=True)
    except Exception:
        data = None
    
    if data:
        
        # Support both URL and base64 data URL
        url = data.get('url') or data.get('image_url')
        if not url:
            return jsonify({'error': 'URL or file is required'}), 400
        
        name = data.get('name', 'Image')
        position = data.get('position', '')
        
        if not position:
            return jsonify({'error': 'Position is required'}), 400
        
        # Get file size if it's a data URL
        file_size = None
        width = None
        height = None
        
        if url.startswith('data:'):
            # Extract base64 data
            try:
                header, encoded = url.split(',', 1)
                file_size = len(encoded) * 3 / 4  # Approximate size
                
                # Try to get dimensions
                try:
                    image_data = base64.b64decode(encoded)
                    img = PILImage.open(BytesIO(image_data))
                    width, height = img.size
                except Exception:
                    pass
            except Exception:
                pass
        
        image = Image(
            user_id=user_id,
            name=name,
            url=url,
            alt_text=data.get('alt_text', ''),
            description=data.get('description', ''),
            category=data.get('category', 'gallery'),
            position=position,
            order=data.get('order', 0),
            is_active=data.get('is_active', True),
            is_public=data.get('is_public', True),
            file_size=file_size,
            width=width,
            height=height
        )
        
        try:
            db.session.add(image)
            db.session.commit()
            return jsonify(image.to_dict()), 201
        except IntegrityError as e:
            db.session.rollback()
            return jsonify({'error': f'Failed to create image: {str(e)}'}), 500
        except Exception as e:
            db.session.rollback()
            return jsonify({'error': f'Unexpected error: {str(e)}'}), 500
    else:
        # Neither file nor valid JSON
        return jsonify({
            'error': 'Invalid request. Please provide either a file upload (multipart/form-data) or JSON data with url and position.'
        }), 400

@images_bp.route('/api/images/<int:image_id>', methods=['PUT'])
@jwt_required()
def update_image(image_id):
    """Update an image (admin only)"""
    user_id = get_admin_id()
    
    if not user_id:
        return jsonify({'error': 'Unauthorized - Admin access required'}), 403
    
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
    user_id = get_admin_id()
    
    if not user_id:
        return jsonify({'error': 'Unauthorized - Admin access required'}), 403
    
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

