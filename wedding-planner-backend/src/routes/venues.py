from flask import Blueprint, request, jsonify, send_file, current_app
from flask_jwt_extended import jwt_required
from src.models import db, Venue, VenueRequest, User
from src.utils.jwt_helpers import get_admin_id
from src.services.venue_scraper import VenueScraperService
from datetime import datetime
import json
import csv
import io
import logging
from src.utils.rbac import require_roles

venues_bp = Blueprint('venues', __name__)
logger = logging.getLogger(__name__)

@venues_bp.route('', methods=['GET'])
@jwt_required()
def get_venues():
    """Get all venues with optional filtering and pagination"""
    try:
        user, err = require_roles(['admin', 'planner'])
        if err:
            return err
        
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
        # Single-instance mode: venues are shared across dashboard users.
        query = Venue.query
        
        if not include_deleted:
            query = query.filter_by(is_deleted=False)
        
        if search:
            search_term = f'%{search}%'
            # Use db.or_ with None checks for columns that might not exist
            conditions = [Venue.name.ilike(search_term)]
            if hasattr(Venue, 'location'):
                conditions.append(Venue.location.ilike(search_term))
            if hasattr(Venue, 'address'):
                conditions.append(Venue.address.ilike(search_term))
            if hasattr(Venue, 'city'):
                conditions.append(Venue.city.ilike(search_term))
            if hasattr(Venue, 'description'):
                conditions.append(Venue.description.ilike(search_term))
            query = query.filter(db.or_(*conditions))
        
        if min_capacity:
            conditions = []
            if hasattr(Venue, 'capacity_max'):
                conditions.append(Venue.capacity_max >= min_capacity)
            if hasattr(Venue, 'capacity'):
                conditions.append(Venue.capacity >= min_capacity)
            if conditions:
                query = query.filter(db.or_(*conditions))
        
        if max_capacity:
            conditions = []
            if hasattr(Venue, 'capacity_min'):
                conditions.append(Venue.capacity_min <= max_capacity)
            if hasattr(Venue, 'capacity'):
                conditions.append(Venue.capacity <= max_capacity)
            if conditions:
                query = query.filter(db.or_(*conditions))
        
        if min_price:
            conditions = []
            if hasattr(Venue, 'price_max'):
                conditions.append(Venue.price_max >= min_price)
            if hasattr(Venue, 'price_min'):
                conditions.append(Venue.price_min >= min_price)
            if conditions:
                query = query.filter(db.or_(*conditions))
        
        if max_price:
            conditions = []
            if hasattr(Venue, 'price_min'):
                conditions.append(Venue.price_min <= max_price)
            if hasattr(Venue, 'price_max'):
                conditions.append(Venue.price_max <= max_price)
            if conditions:
                query = query.filter(db.or_(*conditions))
        
        if style and hasattr(Venue, 'style'):
            query = query.filter_by(style=style)
        
        if city and hasattr(Venue, 'city'):
            query = query.filter(Venue.city.ilike(f'%{city}%'))
        
        if region and hasattr(Venue, 'region'):
            query = query.filter(Venue.region.ilike(f'%{region}%'))
        
        # Pagination
        pagination = query.order_by(Venue.created_at.desc()).paginate(
            page=page, per_page=per_page, error_out=False
        )
        
        venues = pagination.items
        
        # Safely convert venues to dict
        venues_list = []
        for venue in venues:
            try:
                venues_list.append(venue.to_dict())
            except Exception as e:
                # Log error but continue with other venues
                print(f"Error converting venue {venue.id} to dict: {str(e)}")
                # Return basic venue info if to_dict fails
                venues_list.append({
                    'id': venue.id,
                    'name': venue.name or 'Unknown',
                    'error': 'Error loading venue details'
                })
        
        return jsonify({
            'venues': venues_list,
            'pagination': {
                'page': page,
                'per_page': per_page,
                'total': pagination.total,
                'pages': pagination.pages
            }
        }), 200
    
    except Exception as e:
        import traceback
        error_details = traceback.format_exc()
        print(f"Error in get_venues: {str(e)}")
        print(error_details)
        return jsonify({
            'error': 'Internal server error',
            'message': str(e)
        }), 500

@venues_bp.route('', methods=['POST'])
@jwt_required()
def create_venue():
    """Create a new venue (admin/planner)"""
    user, err = require_roles(['admin', 'planner'])
    if err:
        return err
    
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
        user_id=user.id,
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
    user, err = require_roles(['admin', 'planner'])
    if err:
        return err
    
    venue = Venue.query.filter_by(id=venue_id).first()
    
    if not venue:
        return jsonify({'error': 'Venue not found'}), 404
    
    return jsonify(venue.to_dict(include_requests=True)), 200

@venues_bp.route('/<int:venue_id>', methods=['PUT'])
@jwt_required()
def update_venue(venue_id):
    """Update a venue"""
    user, err = require_roles(['admin', 'planner'])
    if err:
        return err
    
    venue = Venue.query.filter_by(id=venue_id).first()
    
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
    user, err = require_roles(['admin', 'planner'])
    if err:
        return err
    
    venue = Venue.query.filter_by(id=venue_id).first()
    
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
    user, err = require_roles(['admin', 'planner'])
    if err:
        return err
    
    venue = Venue.query.filter_by(id=venue_id).first()
    
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
        user_id=user.id,
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
    user, err = require_roles(['admin', 'planner'])
    if err:
        return err
    
    venue_request = VenueRequest.query.filter_by(id=request_id).first()
    
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
    user, err = require_roles(['admin', 'planner'])
    if err:
        return err
    
    venue_request = VenueRequest.query.filter_by(id=request_id).first()
    
    if not venue_request:
        return jsonify({'error': 'Venue request not found'}), 404
    
    db.session.delete(venue_request)
    db.session.commit()
    
    return jsonify({'message': 'Venue request deleted successfully'}), 200

@venues_bp.route('/scrape', methods=['POST'])
@jwt_required()
def scrape_venue():
    """Scrape venue information from a URL"""
    user, err = require_roles(['admin', 'planner'])
    if err:
        return err
    
    data = request.get_json()
    url = data.get('url')
    use_llm = data.get('use_llm', False) or data.get('useLLM', False)  # Support both formats
    
    logger.info(f"🔍 Starting venue scrape for URL: {url}, use_llm: {use_llm}")
    logger.info(f"📦 Request data: {json.dumps(data, indent=2)}")
    
    if not url:
        logger.warning("❌ Scrape request missing URL")
        return jsonify({'error': 'URL is required'}), 400
    
    # Basic scraping
    logger.info(f"🌐 Fetching and parsing URL: {url}")
    venue_data = VenueScraperService.scrape_venue_from_url(url)
    
    if 'error' in venue_data:
        logger.error(f"❌ Scraping error: {venue_data.get('error')}")
        return jsonify(venue_data), 400
    
    logger.info(f"✅ Basic scraping completed. Found {len(venue_data)} fields: {list(venue_data.keys())}")
    
    # Enhance with LLM if requested
    llm_error = None
    if use_llm:
        logger.info(f"🤖 LLM enhancement requested. Starting enhancement...")
        venue_data = VenueScraperService.enhance_with_llm(venue_data, url)
        if 'llm_error' in venue_data:
            llm_error = venue_data.pop('llm_error')
            logger.warning(f"⚠️  LLM enhancement had issues: {llm_error}")
        logger.info(f"✅ LLM enhancement completed. Final fields: {list(venue_data.keys())}")
    else:
        logger.info("ℹ️  LLM enhancement not requested (use_llm=False)")
    
    # Mark as imported via scraper
    venue_data['imported_via_scraper'] = True
    
    # Include LLM error in response if present
    if llm_error:
        venue_data['llm_warning'] = llm_error
    
    logger.info(f"📤 Returning scraped venue data with {len(venue_data)} fields")
    return jsonify(venue_data), 200

@venues_bp.route('/export', methods=['GET'])
@jwt_required()
def export_venues_csv():
    """Export all venues to CSV"""
    user, err = require_roles(['admin', 'planner'])
    if err:
        return err
    
    venues = Venue.query.filter_by(is_deleted=False).all()
    
    # Create CSV in memory
    output = io.StringIO()
    writer = csv.writer(output)
    
    # Write header
    writer.writerow([
        'Name', 'Description', 'Address', 'City', 'Region', 'Location',
        'Capacity Min', 'Capacity Max', 'Price Min', 'Price Max', 'Price Range',
        'Style', 'Amenities', 'Contact Name', 'Contact Email', 'Contact Phone',
        'Website', 'External URL', 'Rating', 'Available Dates', 'Images', 'Notes'
    ])
    
    # Write data
    for venue in venues:
        # Parse amenities with error handling
        amenities_str = ''
        if venue.amenities:
            try:
                amenities_list = json.loads(venue.amenities)
                amenities_str = ', '.join(amenities_list) if isinstance(amenities_list, list) else str(amenities_list)
            except:
                amenities_str = venue.amenities  # Fallback to raw string
        
        # Parse available dates with error handling
        available_dates_str = ''
        if venue.available_dates:
            try:
                dates_list = json.loads(venue.available_dates)
                available_dates_str = ', '.join(dates_list) if isinstance(dates_list, list) else str(dates_list)
            except:
                available_dates_str = venue.available_dates  # Fallback to raw string
        
        # Parse images with error handling
        images_str = ''
        if venue.images:
            try:
                images_list = json.loads(venue.images)
                images_str = ', '.join(images_list) if isinstance(images_list, list) else str(images_list)
            except:
                images_str = venue.images  # Fallback to raw string
        
        writer.writerow([
            venue.name or '',
            venue.description or '',
            venue.address or '',
            venue.city or '',
            venue.region or '',
            venue.location or '',
            venue.capacity_min or '',
            venue.capacity_max or '',
            venue.price_min or '',
            venue.price_max or '',
            venue.price_range or '',
            venue.style or '',
            amenities_str,
            venue.contact_name or '',
            venue.contact_email or '',
            venue.contact_phone or '',
            venue.website or '',
            venue.external_url or '',
            venue.rating or '',
            available_dates_str,
            images_str,
            venue.notes or ''
        ])
    
    # Create response
    output.seek(0)
    mem = io.BytesIO()
    mem.write(output.getvalue().encode('utf-8'))
    mem.seek(0)
    
    return send_file(
        mem,
        mimetype='text/csv',
        as_attachment=True,
        download_name=f'venues_export_{datetime.now().strftime("%Y%m%d_%H%M%S")}.csv'
    )

@venues_bp.route('/import', methods=['POST'])
@jwt_required()
def import_venues_csv():
    """Import venues from CSV"""
    user, err = require_roles(['admin', 'planner'])
    if err:
        return err
    
    if 'file' not in request.files:
        return jsonify({'error': 'No file provided'}), 400
    
    file = request.files['file']
    if file.filename == '':
        return jsonify({'error': 'No file selected'}), 400
    
    if not file.filename.endswith('.csv'):
        return jsonify({'error': 'File must be a CSV'}), 400
    
    try:
        # Read CSV
        stream = io.StringIO(file.stream.read().decode("UTF8"), newline=None)
        csv_reader = csv.DictReader(stream)
        
        imported = 0
        errors = []
        
        for row_num, row in enumerate(csv_reader, start=2):  # Start at 2 (header is row 1)
            try:
                # Parse amenities
                amenities = []
                if row.get('Amenities'):
                    amenities = [a.strip() for a in row['Amenities'].split(',') if a.strip()]
                
                # Parse available dates
                available_dates = []
                if row.get('Available Dates'):
                    available_dates = [d.strip() for d in row['Available Dates'].split(',') if d.strip()]
                
                # Parse images
                images = []
                if row.get('Images'):
                    images = [img.strip() for img in row['Images'].split(',') if img.strip()]
                
                # Create venue
                venue = Venue(
                    user_id=user.id,
                    name=row.get('Name', '').strip(),
                    description=row.get('Description', '').strip() or None,
                    address=row.get('Address', '').strip() or None,
                    city=row.get('City', '').strip() or None,
                    region=row.get('Region', '').strip() or None,
                    location=row.get('Location', '').strip() or None,
                    capacity_min=int(row['Capacity Min']) if row.get('Capacity Min') and row['Capacity Min'].strip() else None,
                    capacity_max=int(row['Capacity Max']) if row.get('Capacity Max') and row['Capacity Max'].strip() else None,
                    capacity=int(row['Capacity']) if row.get('Capacity') and row['Capacity'].strip() else None,
                    price_min=float(row['Price Min']) if row.get('Price Min') and row['Price Min'].strip() else None,
                    price_max=float(row['Price Max']) if row.get('Price Max') and row['Price Max'].strip() else None,
                    price_range=row.get('Price Range', '').strip() or None,
                    style=row.get('Style', '').strip() or None,
                    amenities=json.dumps(amenities) if amenities else None,
                    contact_name=row.get('Contact Name', '').strip() or None,
                    contact_email=row.get('Contact Email', '').strip() or None,
                    contact_phone=row.get('Contact Phone', '').strip() or None,
                    website=row.get('Website', '').strip() or None,
                    external_url=row.get('External URL', '').strip() or None,
                    rating=float(row['Rating']) if row.get('Rating') and row['Rating'].strip() else None,
                    available_dates=json.dumps(available_dates) if available_dates else None,
                    images=json.dumps(images) if images else None,
                    notes=row.get('Notes', '').strip() or None,
                    imported_via_scraper=False
                )
                
                if not venue.name:
                    errors.append(f"Row {row_num}: Name is required")
                    continue
                
                db.session.add(venue)
                imported += 1
                
            except Exception as e:
                errors.append(f"Row {row_num}: {str(e)}")
                continue
        
        db.session.commit()
        
        return jsonify({
            'message': f'Successfully imported {imported} venues',
            'imported': imported,
            'errors': errors
        }), 200
        
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': f'Error importing CSV: {str(e)}'}), 500
