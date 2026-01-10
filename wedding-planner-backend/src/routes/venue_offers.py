"""
Routes for venue offer categories and offers
"""
from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
from src.models import db, Venue, VenueOfferCategory, VenueOffer, User
from src.utils.jwt_helpers import get_admin_id
from sqlalchemy.exc import IntegrityError

offers_bp = Blueprint('venue_offers', __name__)


@offers_bp.route('/venues/<int:venue_id>/categories', methods=['GET'])
@jwt_required()
def get_categories(venue_id):
    """Get all offer categories for a venue"""
    user_id = get_jwt_identity()
    user = User.query.get(user_id)
    
    if not user or user.role != 'admin':
        return jsonify({'error': 'Unauthorized'}), 403
    
    venue = Venue.query.get(venue_id)
    if not venue:
        return jsonify({'error': 'Venue not found'}), 404
    # Allow admin to access any venue
    if venue.user_id != user_id and user.role != 'admin':
        return jsonify({'error': 'Unauthorized'}), 403
    
    categories = VenueOfferCategory.query.filter_by(venue_id=venue_id).order_by(VenueOfferCategory.order).all()
    return jsonify([cat.to_dict(include_offers=True) for cat in categories]), 200


@offers_bp.route('/venues/<int:venue_id>/categories', methods=['POST'])
@jwt_required()
def create_category(venue_id):
    """Create a new offer category"""
    user_id = get_jwt_identity()
    user = User.query.get(user_id)
    
    if not user or user.role != 'admin':
        return jsonify({'error': 'Unauthorized'}), 403
    
    venue = Venue.query.get(venue_id)
    if not venue:
        return jsonify({'error': 'Venue not found'}), 404
    # Allow admin to access any venue
    if venue.user_id != user_id and user.role != 'admin':
        return jsonify({'error': 'Unauthorized'}), 403
    
    data = request.get_json()
    if not data or not data.get('name'):
        return jsonify({'error': 'Category name is required'}), 400
    
    category = VenueOfferCategory(
        venue_id=venue_id,
        name=data['name'],
        description=data.get('description'),
        order=data.get('order', 0)
    )
    
    try:
        db.session.add(category)
        db.session.commit()
        return jsonify(category.to_dict()), 201
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': f'Failed to create category: {str(e)}'}), 500


@offers_bp.route('/venues/<int:venue_id>/categories/<int:category_id>', methods=['PUT'])
@jwt_required()
def update_category(venue_id, category_id):
    """Update an offer category"""
    user_id = get_jwt_identity()
    user = User.query.get(user_id)
    
    if not user or user.role != 'admin':
        return jsonify({'error': 'Unauthorized'}), 403
    
    category = VenueOfferCategory.query.filter_by(id=category_id, venue_id=venue_id).first()
    if not category:
        return jsonify({'error': 'Category not found'}), 404
    
    data = request.get_json()
    if 'name' in data:
        category.name = data['name']
    if 'description' in data:
        category.description = data.get('description')
    if 'order' in data:
        category.order = data.get('order', 0)
    
    try:
        db.session.commit()
        return jsonify(category.to_dict()), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': f'Failed to update category: {str(e)}'}), 500


@offers_bp.route('/venues/<int:venue_id>/categories/<int:category_id>', methods=['DELETE'])
@jwt_required()
def delete_category(venue_id, category_id):
    """Delete an offer category (cascades to offers)"""
    user_id = get_jwt_identity()
    user = User.query.get(user_id)
    
    if not user or user.role != 'admin':
        return jsonify({'error': 'Unauthorized'}), 403
    
    category = VenueOfferCategory.query.filter_by(id=category_id, venue_id=venue_id).first()
    if not category:
        return jsonify({'error': 'Category not found'}), 404
    
    try:
        db.session.delete(category)
        db.session.commit()
        return jsonify({'message': 'Category deleted successfully'}), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': f'Failed to delete category: {str(e)}'}), 500


@offers_bp.route('/venues/<int:venue_id>/categories/<int:category_id>/offers', methods=['POST'])
@jwt_required()
def create_offer(venue_id, category_id):
    """Create a new offer in a category"""
    user_id = get_jwt_identity()
    user = User.query.get(user_id)
    
    if not user or user.role != 'admin':
        return jsonify({'error': 'Unauthorized'}), 403
    
    category = VenueOfferCategory.query.filter_by(id=category_id, venue_id=venue_id).first()
    if not category:
        return jsonify({'error': 'Category not found'}), 404
    
    data = request.get_json()
    if not data or not data.get('name'):
        return jsonify({'error': 'Offer name is required'}), 400
    
    offer = VenueOffer(
        category_id=category_id,
        venue_id=venue_id,
        name=data['name'],
        description=data.get('description'),
        price=float(data['price']) if data.get('price') else None,
        price_type=data.get('price_type', 'fixed'),
        currency=data.get('currency', 'EUR'),
        unit=data.get('unit'),
        order=data.get('order', 0),
        min_quantity=data.get('min_quantity'),
        max_quantity=data.get('max_quantity'),
        is_available=data.get('is_available', True),
        notes=data.get('notes')
    )
    
    try:
        db.session.add(offer)
        db.session.commit()
        return jsonify(offer.to_dict()), 201
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': f'Failed to create offer: {str(e)}'}), 500


@offers_bp.route('/venues/<int:venue_id>/offers/<int:offer_id>', methods=['PUT'])
@jwt_required()
def update_offer(venue_id, offer_id):
    """Update an offer"""
    user_id = get_jwt_identity()
    user = User.query.get(user_id)
    
    if not user or user.role != 'admin':
        return jsonify({'error': 'Unauthorized'}), 403
    
    offer = VenueOffer.query.filter_by(id=offer_id, venue_id=venue_id).first()
    if not offer:
        return jsonify({'error': 'Offer not found'}), 404
    
    data = request.get_json()
    if 'name' in data:
        offer.name = data['name']
    if 'description' in data:
        offer.description = data.get('description')
    if 'price' in data:
        offer.price = float(data['price']) if data.get('price') else None
    if 'price_type' in data:
        offer.price_type = data['price_type']
    if 'currency' in data:
        offer.currency = data['currency']
    if 'unit' in data:
        offer.unit = data.get('unit')
    if 'order' in data:
        offer.order = data.get('order', 0)
    if 'min_quantity' in data:
        offer.min_quantity = data.get('min_quantity')
    if 'max_quantity' in data:
        offer.max_quantity = data.get('max_quantity')
    if 'is_available' in data:
        offer.is_available = data.get('is_available', True)
    if 'notes' in data:
        offer.notes = data.get('notes')
    
    try:
        db.session.commit()
        return jsonify(offer.to_dict()), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': f'Failed to update offer: {str(e)}'}), 500


@offers_bp.route('/venues/<int:venue_id>/offers/<int:offer_id>', methods=['DELETE'])
@jwt_required()
def delete_offer(venue_id, offer_id):
    """Delete an offer"""
    user_id = get_jwt_identity()
    user = User.query.get(user_id)
    
    if not user or user.role != 'admin':
        return jsonify({'error': 'Unauthorized'}), 403
    
    offer = VenueOffer.query.filter_by(id=offer_id, venue_id=venue_id).first()
    if not offer:
        return jsonify({'error': 'Offer not found'}), 404
    
    try:
        db.session.delete(offer)
        db.session.commit()
        return jsonify({'message': 'Offer deleted successfully'}), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': f'Failed to delete offer: {str(e)}'}), 500
