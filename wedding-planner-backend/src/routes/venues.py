from flask import Blueprint, request, jsonify, send_file
from flask_jwt_extended import jwt_required
from src.models import db, Venue, VenueRequest, User
from src.utils.jwt_helpers import get_admin_id
from src.services.venue_scraper import VenueScraperService
from datetime import datetime
import json
import csv
import io

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
    max_capacity = request.args.get('max_capacity', type=int)
    min_price = request.args.get('min_price', type=float)
    max_price = request.args.get('max_price', type=float)
    style = request.args.get('style', '').strip()
    city = request.args.get('city', '').strip()
    region = request.args.get('region', '').strip()
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
                Venue.address.ilike(search_term),
                Venue.city.ilike(search_term),
                Venue.description.ilike(search_term)
            )
        )
    
    if min_capacity:
        query = query.filter(
            db.or_(
                Venue.capacity_max >= min_capacity,
                Venue.capacity >= min_capacity
            )
        )
    
    if max_capacity:
        query = query.filter(
            db.or_(
                Venue.capacity_min <= max_capacity,
                Venue.capacity <= max_capacity
            )
        )
    
    if min_price:
        query = query.filter(
            db.or_(
                Venue.price_max >= min_price,
                Venue.price_min >= min_price
            )
        )
    
    if max_price:
        query = query.filter(
            db.or_(
                Venue.price_min <= max_price,
                Venue.price_max <= max_price
            )
        )
    
    if style:
        query = query.filter_by(style=style)
    
    if city:
        query = query.filter(Venue.city.ilike(f'%{city}%'))
    
    if region:
        query = query.filter(Venue.region.ilike(f'%{region}%'))
    
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
    
    # Handle available_dates - convert list to JSON string
    available_dates = data.get('available_dates', [])
    if isinstance(available_dates, list):
        available_dates_str = json.dumps(available_dates)
    else:
        available_dates_str = ''
    
    # Handle images - convert list to JSON string
    images = data.get('images', [])
    if isinstance(images, list):
        images_str = json.dumps(images)
    else:
        images_str = ''
    
    venue = Venue(
        user_id=user_id,
        name=data['name'],
        description=data.get('description'),
        # Location fields
        address=data.get('address'),
        city=data.get('city'),
        region=data.get('region'),
        location=data.get('location'),  # Keep for backward compatibility
        # Capacity fields
        capacity_min=data.get('capacity_min'),
        capacity_max=data.get('capacity_max'),
        capacity=data.get('capacity'),  # Keep for backward compatibility
        # Price fields
        price_min=data.get('price_min'),
        price_max=data.get('price_max'),
        price_range=data.get('price_range'),  # Keep for backward compatibility
        # Style and amenities
        style=data.get('style'),
        amenities=amenities_str,
        # Contact information
        contact_name=data.get('contact_name'),
        contact_email=data.get('contact_email'),
        contact_phone=data.get('contact_phone'),
        website=data.get('website'),
        external_url=data.get('external_url'),
        # Additional fields
        available_dates=available_dates_str,
        rating=data.get('rating'),
        images=images_str,
        imported_via_scraper=data.get('imported_via_scraper', False),
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
    
    # Basic fields
    if 'name' in data:
        venue.name = data['name']
    if 'description' in data:
        venue.description = data.get('description')
    
    # Location fields
    if 'address' in data:
        venue.address = data.get('address')
    if 'city' in data:
        venue.city = data.get('city')
    if 'region' in data:
        venue.region = data.get('region')
    if 'location' in data:
        venue.location = data.get('location')
    
    # Capacity fields
    if 'capacity_min' in data:
        venue.capacity_min = data.get('capacity_min')
    if 'capacity_max' in data:
        venue.capacity_max = data.get('capacity_max')
    if 'capacity' in data:
        venue.capacity = data.get('capacity')
    
    # Price fields
    if 'price_min' in data:
        venue.price_min = data.get('price_min')
    if 'price_max' in data:
        venue.price_max = data.get('price_max')
    if 'price_range' in data:
        venue.price_range = data.get('price_range')
    
    # Style and amenities
    if 'style' in data:
        venue.style = data.get('style')
    if 'amenities' in data:
        amenities = data.get('amenities', [])
        if isinstance(amenities, list):
            venue.amenities = json.dumps(amenities)
        else:
            venue.amenities = amenities
    
    # Contact information
    if 'contact_name' in data:
        venue.contact_name = data.get('contact_name')
    if 'contact_email' in data:
        venue.contact_email = data.get('contact_email')
    if 'contact_phone' in data:
        venue.contact_phone = data.get('contact_phone')
    if 'website' in data:
        venue.website = data.get('website')
    if 'external_url' in data:
        venue.external_url = data.get('external_url')
    
    # Additional fields
    if 'available_dates' in data:
        available_dates = data.get('available_dates', [])
        if isinstance(available_dates, list):
            venue.available_dates = json.dumps(available_dates)
        else:
            venue.available_dates = available_dates
    if 'rating' in data:
        venue.rating = data.get('rating')
    if 'images' in data:
        images = data.get('images', [])
        if isinstance(images, list):
            venue.images = json.dumps(images)
        else:
            venue.images = images
    if 'imported_via_scraper' in data:
        venue.imported_via_scraper = data.get('imported_via_scraper', False)
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

