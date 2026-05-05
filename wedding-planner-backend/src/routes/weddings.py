"""
Wedding (tenant) management routes.

POST /api/weddings/create    — Create a new wedding tenant after signup
GET  /api/weddings/current   — Return the active wedding for the authenticated user
PUT  /api/weddings/current   — Update wedding details (names, date, location)
GET  /api/weddings/<slug>    — Public: fetch a wedding by slug (for guest portal)
"""
from flask import Blueprint, request, jsonify, g
from flask_jwt_extended import jwt_required, get_jwt_identity
from models import db
from models.user import User
from models.wedding import Wedding, _generate_slug
from utils.tenant import tenant_required
from datetime import datetime, date
import re

weddings_bp = Blueprint('weddings', __name__)


def _unique_slug(base_slug: str) -> str:
    """Ensure slug is unique by appending a suffix if needed."""
    slug = base_slug
    counter = 1
    while Wedding.query.filter_by(slug=slug).first():
        slug = f"{base_slug}-{counter}"
        counter += 1
    return slug


@weddings_bp.route('/create', methods=['POST'])
@jwt_required()
def create_wedding():
    """
    Create a new Wedding tenant for the authenticated user.
    Called during onboarding after the user has registered.
    """
    identity = get_jwt_identity()
    if isinstance(identity, str) and identity.startswith('guest_'):
        return jsonify({'error': 'Not allowed for guest tokens'}), 403

    try:
        user_id = int(identity)
    except (TypeError, ValueError):
        return jsonify({'error': 'Invalid token identity'}), 401

    user = db.session.get(User, user_id)
    if not user:
        return jsonify({'error': 'User not found'}), 404

    data = request.get_json() or {}

    partner_one = str(data.get('partner_one_name') or '').strip()
    partner_two = str(data.get('partner_two_name') or '').strip()
    if not partner_one or not partner_two:
        return jsonify({'error': 'partner_one_name and partner_two_name are required'}), 400

    # Parse wedding date
    wedding_date_raw = data.get('wedding_date')
    wedding_date = None
    if wedding_date_raw:
        try:
            wedding_date = date.fromisoformat(str(wedding_date_raw))
        except ValueError:
            return jsonify({'error': 'Invalid wedding_date. Use YYYY-MM-DD format.'}), 400

    # Generate slug
    year = wedding_date.year if wedding_date else datetime.utcnow().year
    base_slug = _generate_slug(partner_one, partner_two, year)

    # Allow custom slug on paid plans (or pre-check — plan isn't set yet so default to generated)
    custom_slug = str(data.get('slug') or '').strip().lower()
    if custom_slug:
        # Sanitise
        custom_slug = re.sub(r'[^a-z0-9-]', '-', custom_slug)
        custom_slug = re.sub(r'-+', '-', custom_slug).strip('-')
        if len(custom_slug) < 3:
            return jsonify({'error': 'Custom slug must be at least 3 characters'}), 400
        base_slug = custom_slug

    slug = _unique_slug(base_slug)

    # Check if user already has a wedding
    existing = Wedding.query.filter_by(owner_id=user_id).first()
    if existing:
        return jsonify({'error': 'You already have a wedding. Use PUT /api/weddings/current to update it.', 'wedding': existing.to_dict()}), 409

    wedding = Wedding(
        owner_id=user_id,
        slug=slug,
        partner_one_name=partner_one,
        partner_two_name=partner_two,
        wedding_date=wedding_date,
        location=str(data.get('location') or '').strip() or None,
        plan='free',
        is_active=True,
    )
    db.session.add(wedding)
    db.session.flush()

    # Set user's current_wedding_id
    user.current_wedding_id = wedding.id
    db.session.commit()

    return jsonify({'message': 'Wedding created successfully', 'wedding': wedding.to_dict()}), 201


@weddings_bp.route('/current', methods=['GET'])
@tenant_required
def get_current_wedding():
    """Return the active wedding for the authenticated user."""
    return jsonify(g.wedding.to_dict()), 200


@weddings_bp.route('/current', methods=['PUT'])
@tenant_required
def update_current_wedding():
    """Update wedding details."""
    data = request.get_json() or {}
    wedding = g.wedding

    if 'partner_one_name' in data:
        wedding.partner_one_name = str(data['partner_one_name']).strip() or wedding.partner_one_name
    if 'partner_two_name' in data:
        wedding.partner_two_name = str(data['partner_two_name']).strip() or wedding.partner_two_name
    if 'location' in data:
        wedding.location = str(data['location']).strip() or None
    if 'wedding_date' in data and data['wedding_date']:
        try:
            wedding.wedding_date = date.fromisoformat(str(data['wedding_date']))
        except ValueError:
            return jsonify({'error': 'Invalid wedding_date format'}), 400

    # Slug updates only allowed on paid plans
    if 'slug' in data and data['slug']:
        if not wedding.meets_plan('starter'):
            return jsonify({'error': 'Custom slug requires Starter plan or higher', 'upgrade_url': '/admin/billing'}), 402
        new_slug = re.sub(r'[^a-z0-9-]', '-', str(data['slug']).lower())
        new_slug = re.sub(r'-+', '-', new_slug).strip('-')
        if new_slug != wedding.slug:
            if Wedding.query.filter_by(slug=new_slug).filter(Wedding.id != wedding.id).first():
                return jsonify({'error': 'That slug is already taken'}), 409
            wedding.slug = new_slug

    db.session.commit()
    return jsonify(wedding.to_dict()), 200


@weddings_bp.route('/by-slug/<slug>', methods=['GET'])
def get_wedding_by_slug(slug):
    """
    Public endpoint — fetch wedding details by slug.
    Used by the guest portal at /w/{slug}.
    Does NOT require authentication.
    """
    wedding = Wedding.query.filter_by(slug=slug, is_active=True).first()
    if not wedding:
        return jsonify({'error': 'Wedding not found'}), 404

    # Return only public-safe fields
    return jsonify({
        'id': wedding.id,
        'slug': wedding.slug,
        'partner_one_name': wedding.partner_one_name,
        'partner_two_name': wedding.partner_two_name,
        'wedding_date': wedding.wedding_date.isoformat() if wedding.wedding_date else None,
        'location': wedding.location,
        'plan': wedding.plan,
    }), 200
