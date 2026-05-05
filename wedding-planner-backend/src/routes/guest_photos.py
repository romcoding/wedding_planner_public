from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
from models import db, GuestPhoto, Guest
from sqlalchemy.exc import IntegrityError
import base64
from io import BytesIO
from PIL import Image as PILImage

guest_photos_bp = Blueprint('guest_photos', __name__)

@guest_photos_bp.route('', methods=['GET'])
def get_guest_photos():
    """Get guest photos (public approved photos for guests, all for admins)"""
    auth_header = request.headers.get('Authorization')
    is_admin = False
    
    if auth_header and auth_header.startswith('Bearer '):
        try:
            from flask_jwt_extended import decode_token
            token = auth_header.split(' ')[1]
            decoded = decode_token(token)
            user_id = decoded.get('sub')
            if not str(user_id).startswith('guest_'):
                from models import User
                user = User.query.get(user_id)
                is_admin = user and user.role == 'admin'
        except:
            pass
    
    if is_admin:
        photos = GuestPhoto.query.filter_by(is_active=True).order_by(GuestPhoto.created_at.desc()).all()
    else:
        photos = GuestPhoto.query.filter_by(is_approved=True, is_public=True).order_by(GuestPhoto.created_at.desc()).all()
    
    return jsonify([photo.to_dict() for photo in photos]), 200

@guest_photos_bp.route('', methods=['POST'])
@jwt_required()
def upload_guest_photo():
    """Upload a guest photo"""
    identity = get_jwt_identity()
    
    if not str(identity).startswith('guest_'):
        return jsonify({'error': 'Only guests can upload photos'}), 403
    
    guest_id = int(identity.split('_')[1])
    guest = Guest.query.get(guest_id)
    
    if not guest:
        return jsonify({'error': 'Guest not found'}), 404
    
    # Check if this is a file upload or JSON
    if 'file' in request.files:
        file = request.files['file']
        caption = request.form.get('caption', '')
        
        if not file or file.filename == '':
            return jsonify({'error': 'No file selected'}), 400
        
        # Validate file type
        allowed_extensions = {'png', 'jpg', 'jpeg', 'gif', 'webp'}
        if not ('.' in file.filename and file.filename.rsplit('.', 1)[1].lower() in allowed_extensions):
            return jsonify({'error': 'Invalid file type'}), 400
        
        # Read and convert to base64
        file_data = file.read()
        file_size = len(file_data)
        
        if file_size > 10 * 1024 * 1024:
            return jsonify({'error': 'File size exceeds 10MB limit'}), 400
        
        image_base64 = base64.b64encode(file_data).decode('utf-8')
        mime_type = file.content_type or 'image/jpeg'
        data_url = f'data:{mime_type};base64,{image_base64}'
        
        # Get dimensions
        try:
            img = PILImage.open(BytesIO(file_data))
            width, height = img.size
        except Exception:
            width, height = None, None
        
        photo = GuestPhoto(
            guest_id=guest_id,
            name=file.filename,
            url=data_url,
            caption=caption,
            is_approved=False,  # Requires admin approval
            is_public=True,
            file_size=file_size,
            width=width,
            height=height
        )
        
        try:
            db.session.add(photo)
            db.session.commit()
            return jsonify({
                'message': 'Photo uploaded successfully. It will be visible after admin approval.',
                'photo': photo.to_dict()
            }), 201
        except IntegrityError:
            db.session.rollback()
            return jsonify({'error': 'Failed to upload photo'}), 500
    else:
        return jsonify({'error': 'No file provided'}), 400

@guest_photos_bp.route('/<int:photo_id>/approve', methods=['POST'])
@jwt_required()
def approve_photo(photo_id):
    """Approve a guest photo (admin only)"""
    identity = get_jwt_identity()
    
    if str(identity).startswith('guest_'):
        return jsonify({'error': 'Unauthorized'}), 403
    
    from models import User
    user = User.query.get(identity)
    if not user or user.role != 'admin':
        return jsonify({'error': 'Unauthorized'}), 403
    
    photo = GuestPhoto.query.get_or_404(photo_id)
    photo.is_approved = True
    
    db.session.commit()
    return jsonify(photo.to_dict()), 200

@guest_photos_bp.route('/<int:photo_id>', methods=['DELETE'])
@jwt_required()
def delete_photo(photo_id):
    """Delete a photo (guest can delete their own, admin can delete any)"""
    identity = get_jwt_identity()
    photo = GuestPhoto.query.get_or_404(photo_id)
    
    if str(identity).startswith('guest_'):
        guest_id = int(identity.split('_')[1])
        if photo.guest_id != guest_id:
            return jsonify({'error': 'Unauthorized'}), 403
    else:
        from models import User
        user = User.query.get(identity)
        if not user or user.role != 'admin':
            return jsonify({'error': 'Unauthorized'}), 403
    
    db.session.delete(photo)
    db.session.commit()
    return jsonify({'message': 'Photo deleted successfully'}), 200

