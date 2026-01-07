from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required
from src.models import db, Venue, VenueRequest, User
from src.utils.jwt_helpers import get_admin_id
from src.services.venue_scraper import VenueScraperService
from datetime import datetime
import json

venues_bp = Blueprint('venues', __name__)

@venues_bp.route('', methods=['GET'])
@jwt_required()
def get_venues():
    """Get all venues with optional filtering and pagination"""
    user_id = get_admin_id()
    
    if not user_id:
        return jsonify({'error': 'Unauthorized - Admin access required'}), 403
    
    # Query parameters
    search = request.args.get('search', '').strip()
    min_capacity = request.args.get('min_capacity', type=int)
    max_price = request.args.get('max_price', type=float)
    style = request.args.get('style', '').strip()
    page = request.args.get('page', 1, type=int)
    per_page = request.args.get('per_page', 50, type=int)
    include_deleted = request.args.get('include_deleted', 'false').lower() == 'true'
    
    # Build query
    query = Venue.query.filter_by(user_id=user_id)
    
    if not include_deleted:
        query = query.filter_by(is_deleted=False)
    
    if search:
        search_term = f'%{search}%'
        query = query.filter(
            db.or_(
                Venue.name.ilike(search_term),
                Venue.location.ilike(search_term),
                Venue.description.ilike(search_term)
            )
        )
    
    if min_capacity:
        query = query.filter(Venue.capacity >= min_capacity)
    
    if style:
        query = query.filter_by(style=style)
    
    # Note: max_price filtering would require parsing price_range string
    # For now, we'll skip this or implement a more sophisticated parser
    
    # Pagination
    pagination = query.order_by(Venue.created_at.desc()).paginate(
        page=page, per_page=per_page, error_out=False
    )
    
    venues = pagination.items
    
    return jsonify({
        'venues': [venue.to_dict() for venue in venues],
        'pagination': {
            'page': page,
            'per_page': per_page,
            'total': pagination.total,
            'pages': pagination.pages
        }
    }), 200

@venues_bp.route('', methods=['POST'])
@jwt_required()
def create_venue():
    """Create a new venue (admin only)"""
    user_id = get_admin_id()
    
    if not user_id:
        return jsonify({'error': 'Unauthorized - Admin access required'}), 403
    
    user = User.query.get(user_id)
    if not user:
        return jsonify({'error': 'User not found'}), 404
    
    data = request.get_json()
    
    if not data or not data.get('name'):
        return jsonify({'error': 'Name is required'}), 400
    
    # Handle amenities - convert list to JSON string
    amenities = data.get('amenities', [])
    if isinstance(amenities, list):
        amenities_str = json.dumps(amenities)
    elif isinstance(amenities, str):
        amenities_str = amenities
    else:
        amenities_str = ''
    
    venue = Venue(
        user_id=user_id,
        name=data['name'],
        description=data.get('description'),
        location=data.get('location'),
        capacity=data.get('capacity'),
        price_range=data.get('price_range'),
        style=data.get('style'),
        amenities=amenities_str,
        contact_name=data.get('contact_name'),
        contact_email=data.get('contact_email'),
        contact_phone=data.get('contact_phone'),
        website=data.get('website'),
        rating=data.get('rating'),
        notes=data.get('notes')
    )
    
    db.session.add(venue)
    db.session.commit()
    
    return jsonify(venue.to_dict()), 201

@venues_bp.route('/<int:venue_id>', methods=['GET'])
@jwt_required()
def get_venue(venue_id):
    """Get venue details with associated requests"""
    user_id = get_admin_id()
    
    if not user_id:
        return jsonify({'error': 'Unauthorized - Admin access required'}), 403
    
    venue = Venue.query.filter_by(id=venue_id, user_id=user_id).first()
    
    if not venue:
        return jsonify({'error': 'Venue not found'}), 404
    
    return jsonify(venue.to_dict(include_requests=True)), 200

@venues_bp.route('/<int:venue_id>', methods=['PUT'])
@jwt_required()
def update_venue(venue_id):
    """Update a venue"""
    user_id = get_admin_id()
    
    if not user_id:
        return jsonify({'error': 'Unauthorized - Admin access required'}), 403
    
    venue = Venue.query.filter_by(id=venue_id, user_id=user_id).first()
    
    if not venue:
        return jsonify({'error': 'Venue not found'}), 404
    
    data = request.get_json()
    
    if 'name' in data:
        venue.name = data['name']
    if 'description' in data:
        venue.description = data.get('description')
    if 'location' in data:
        venue.location = data.get('location')
    if 'capacity' in data:
        venue.capacity = data.get('capacity')
    if 'price_range' in data:
        venue.price_range = data.get('price_range')
    if 'style' in data:
        venue.style = data.get('style')
    if 'amenities' in data:
        amenities = data.get('amenities', [])
        if isinstance(amenities, list):
            venue.amenities = json.dumps(amenities)
        else:
            venue.amenities = amenities
    if 'contact_name' in data:
        venue.contact_name = data.get('contact_name')
    if 'contact_email' in data:
        venue.contact_email = data.get('contact_email')
    if 'contact_phone' in data:
        venue.contact_phone = data.get('contact_phone')
    if 'website' in data:
        venue.website = data.get('website')
    if 'rating' in data:
        venue.rating = data.get('rating')
    if 'notes' in data:
        venue.notes = data.get('notes')
    
    venue.updated_at = datetime.utcnow()
    db.session.commit()
    
    return jsonify(venue.to_dict()), 200

@venues_bp.route('/<int:venue_id>', methods=['DELETE'])
@jwt_required()
def delete_venue(venue_id):
    """Soft delete a venue"""
    user_id = get_admin_id()
    
    if not user_id:
        return jsonify({'error': 'Unauthorized - Admin access required'}), 403
    
    venue = Venue.query.filter_by(id=venue_id, user_id=user_id).first()
    
    if not venue:
        return jsonify({'error': 'Venue not found'}), 404
    
    venue.is_deleted = True
    venue.updated_at = datetime.utcnow()
    db.session.commit()
    
    return jsonify({'message': 'Venue deleted successfully'}), 200

@venues_bp.route('/<int:venue_id>/requests', methods=['POST'])
@jwt_required()
def create_venue_request(venue_id):
    """Create a venue request"""
    user_id = get_admin_id()
    
    if not user_id:
        return jsonify({'error': 'Unauthorized - Admin access required'}), 403
    
    venue = Venue.query.filter_by(id=venue_id, user_id=user_id).first()
    
    if not venue:
        return jsonify({'error': 'Venue not found'}), 404
    
    data = request.get_json()
    
    if not data or not data.get('contact_date'):
        return jsonify({'error': 'Contact date is required'}), 400
    
    try:
        contact_date = datetime.strptime(data['contact_date'], '%Y-%m-%d').date()
    except ValueError:
        return jsonify({'error': 'Invalid date format. Use YYYY-MM-DD'}), 400
    
    venue_request = VenueRequest(
        venue_id=venue_id,
        user_id=user_id,
        contact_date=contact_date,
        status=data.get('status', 'pending'),
        proposed_price=data.get('proposed_price'),
        notes=data.get('notes')
    )
    
    db.session.add(venue_request)
    db.session.commit()
    
    return jsonify(venue_request.to_dict()), 201

@venues_bp.route('/requests/<int:request_id>', methods=['PUT'])
@jwt_required()
def update_venue_request(request_id):
    """Update a venue request"""
    user_id = get_admin_id()
    
    if not user_id:
        return jsonify({'error': 'Unauthorized - Admin access required'}), 403
    
    venue_request = VenueRequest.query.filter_by(id=request_id, user_id=user_id).first()
    
    if not venue_request:
        return jsonify({'error': 'Venue request not found'}), 404
    
    data = request.get_json()
    
    if 'contact_date' in data:
        try:
            venue_request.contact_date = datetime.strptime(data['contact_date'], '%Y-%m-%d').date()
        except ValueError:
            return jsonify({'error': 'Invalid date format. Use YYYY-MM-DD'}), 400
    if 'status' in data:
        venue_request.status = data['status']
    if 'proposed_price' in data:
        venue_request.proposed_price = data.get('proposed_price')
    if 'notes' in data:
        venue_request.notes = data.get('notes')
    
    venue_request.updated_at = datetime.utcnow()
    db.session.commit()
    
    return jsonify(venue_request.to_dict()), 200

@venues_bp.route('/requests/<int:request_id>', methods=['DELETE'])
@jwt_required()
def delete_venue_request(request_id):
    """Delete a venue request"""
    user_id = get_admin_id()
    
    if not user_id:
        return jsonify({'error': 'Unauthorized - Admin access required'}), 403
    
    venue_request = VenueRequest.query.filter_by(id=request_id, user_id=user_id).first()
    
    if not venue_request:
        return jsonify({'error': 'Venue request not found'}), 404
    
    db.session.delete(venue_request)
    db.session.commit()
    
    return jsonify({'message': 'Venue request deleted successfully'}), 200

@venues_bp.route('/scrape', methods=['POST'])
@jwt_required()
def scrape_venue():
    """Scrape venue information from a URL"""
    user_id = get_admin_id()
    
    if not user_id:
        return jsonify({'error': 'Unauthorized - Admin access required'}), 403
    
    data = request.get_json()
    url = data.get('url')
    use_llm = data.get('use_llm', False)
    
    if not url:
        return jsonify({'error': 'URL is required'}), 400
    
    # Basic scraping
    venue_data = VenueScraperService.scrape_venue_from_url(url)
    
    if 'error' in venue_data:
        return jsonify(venue_data), 400
    
    # Enhance with LLM if requested
    if use_llm:
        venue_data = VenueScraperService.enhance_with_llm(venue_data, url)
    
    return jsonify(venue_data), 200

