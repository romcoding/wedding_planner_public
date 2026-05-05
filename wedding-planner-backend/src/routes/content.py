from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
from models import db, Content, User
from utils.jwt_helpers import get_admin_id
from services.translation_service import TranslationService

content_bp = Blueprint('content', __name__)

@content_bp.route('', methods=['GET'])
def get_content():
    """Get public content (no auth required) or all content (admin)"""
    is_public_only = not request.args.get('admin', '').lower() == 'true'
    language = request.args.get('lang', 'en')  # Get language parameter
    
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
            
            # Return all content for admin (with all languages)
            contents = Content.query.order_by(Content.order.asc()).all()
        except:
            return jsonify({'error': 'Unauthorized'}), 401
    
    # Filter by scheduling for public content
    if is_public_only:
        from datetime import datetime
        now = datetime.utcnow()
        filtered_contents = []
        for content in contents:
            # Check if content should be visible based on scheduling
            if content.scheduled_publish_at and content.scheduled_publish_at > now:
                continue  # Not published yet
            if content.scheduled_unpublish_at and content.scheduled_unpublish_at <= now:
                continue  # Already unpublished
            filtered_contents.append(content)
        return jsonify([content.to_dict(language=language) for content in filtered_contents]), 200
    else:
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
    
    language = request.args.get('lang', 'en')
    return jsonify(content.to_dict(language=language)), 200

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
    
    # Accept either content (legacy) or content_en for new multilingual system
    if not data or not data.get('key') or (not data.get('content') and not data.get('content_en')):
        return jsonify({'error': 'Key and content (or content_en) are required'}), 400
    
    if Content.query.filter_by(key=data['key']).first():
        return jsonify({'error': 'Content with this key already exists'}), 400
    
    # Auto-translate if source language is provided
    source_lang = data.get('source_language', 'en')
    source_content = data.get('content_en') or data.get('content_de') or data.get('content_fr') or data.get('content', '')
    
    # Determine which language was provided
    if data.get('content_de') and not data.get('content_en') and not data.get('content_fr'):
        source_lang = 'de'
        source_content = data.get('content_de')
    elif data.get('content_fr') and not data.get('content_en') and not data.get('content_de'):
        source_lang = 'fr'
        source_content = data.get('content_fr')
    elif data.get('content_en'):
        source_lang = 'en'
        source_content = data.get('content_en')
    
    # Auto-translate to other languages if auto_translate is enabled
    auto_translate = data.get('auto_translate', False)
    if auto_translate and source_content:
        translations = TranslationService.auto_translate_all(source_content, source_lang)
        content_en = translations.get('en', '')
        content_de = translations.get('de', '')
        content_fr = translations.get('fr', '')
    else:
        content_en = data.get('content_en', data.get('content', ''))
        content_de = data.get('content_de', '')
        content_fr = data.get('content_fr', '')
    
    from datetime import datetime
    
    scheduled_publish_at = None
    if data.get('scheduled_publish_at'):
        try:
            scheduled_publish_at = datetime.fromisoformat(data['scheduled_publish_at'].replace('Z', '+00:00'))
        except ValueError:
            return jsonify({'error': 'Invalid scheduled_publish_at format'}), 400
    
    scheduled_unpublish_at = None
    if data.get('scheduled_unpublish_at'):
        try:
            scheduled_unpublish_at = datetime.fromisoformat(data['scheduled_unpublish_at'].replace('Z', '+00:00'))
        except ValueError:
            return jsonify({'error': 'Invalid scheduled_unpublish_at format'}), 400
    
    # Determine if content should be published immediately
    now = datetime.utcnow()
    published_at = None
    is_public = data.get('is_public', True)
    
    if scheduled_publish_at:
        if scheduled_publish_at <= now:
            published_at = now
            is_public = True
        else:
            is_public = False  # Not published yet if scheduled for future
    elif is_public:
        published_at = now
    
    content = Content(
        key=data['key'],
        title=data.get('title'),
        content=content_en or source_content,  # Legacy field
        content_en=content_en,
        content_de=content_de,
        content_fr=content_fr,
        content_type=data.get('content_type', 'html'),
        is_public=is_public,
        order=data.get('order', 0),
        published_at=published_at,
        scheduled_publish_at=scheduled_publish_at,
        scheduled_unpublish_at=scheduled_unpublish_at
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
        content.content = data['content']  # Legacy field
    if 'content_en' in data:
        content.content_en = data['content_en']
    if 'content_de' in data:
        content.content_de = data['content_de']
    if 'content_fr' in data:
        content.content_fr = data['content_fr']
    if 'content_type' in data:
        content.content_type = data['content_type']
    if 'is_public' in data:
        content.is_public = data['is_public']
    if 'order' in data:
        content.order = data['order']
    if 'scheduled_publish_at' in data:
        if data['scheduled_publish_at']:
            try:
                from datetime import datetime
                content.scheduled_publish_at = datetime.fromisoformat(data['scheduled_publish_at'].replace('Z', '+00:00'))
            except ValueError:
                return jsonify({'error': 'Invalid scheduled_publish_at format'}), 400
        else:
            content.scheduled_publish_at = None
    if 'scheduled_unpublish_at' in data:
        if data['scheduled_unpublish_at']:
            try:
                from datetime import datetime
                content.scheduled_unpublish_at = datetime.fromisoformat(data['scheduled_unpublish_at'].replace('Z', '+00:00'))
            except ValueError:
                return jsonify({'error': 'Invalid scheduled_unpublish_at format'}), 400
        else:
            content.scheduled_unpublish_at = None
    
    # Auto-publish if scheduled time has passed
    from datetime import datetime
    now = datetime.utcnow()
    if content.scheduled_publish_at and content.scheduled_publish_at <= now and not content.published_at:
        content.published_at = now
        content.is_public = True
    
    # Auto-unpublish if scheduled time has passed
    if content.scheduled_unpublish_at and content.scheduled_unpublish_at <= now:
        content.is_public = False
    
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

