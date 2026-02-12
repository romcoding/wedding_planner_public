from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
from src.models import db, Event, User, Content, Venue
from src.utils.jwt_helpers import get_admin_id
from datetime import datetime
from sqlalchemy.exc import IntegrityError
from src.utils.rbac import require_roles

events_bp = Blueprint('events', __name__)

@events_bp.route('', methods=['GET'])
def get_events():
    """Get all events (public events for guests, all for admins)"""
    # Check if user is authenticated (admin)
    auth_header = request.headers.get('Authorization')
    is_admin = False
    
    if auth_header and auth_header.startswith('Bearer '):
        try:
            from flask_jwt_extended import decode_token
            token = auth_header.split(' ')[1]
            decoded = decode_token(token)
            identity = decoded.get('sub')
            
            # Check if it's an admin token (not guest)
            if identity:
                identity_str = str(identity)
                if not identity_str.startswith('guest_'):
                    # Try to get admin ID
                    try:
                        admin_id = int(identity_str) if isinstance(identity_str, str) else identity
                        user = User.query.get(admin_id)
                        is_admin = user and user.role in ['admin', 'planner']
                    except (ValueError, TypeError):
                        pass
        except:
            pass
    
    if is_admin:
        # Admins see all events
        events = Event.query.filter_by(is_active=True).order_by(Event.order, Event.start_time).all()
    else:
        # Guests see only public, active events (always filter by is_public=True)
        events = Event.query.filter_by(is_public=True, is_active=True).order_by(Event.order, Event.start_time).all()
    
    return jsonify([event.to_dict() for event in events]), 200

@events_bp.route('', methods=['POST'])
@jwt_required()
def create_event():
    """Create a new event (admin/planner)"""
    user, err = require_roles(['admin', 'planner'])
    if err:
        return err
    
    data = request.get_json()
    
    # Validate required fields
    errors = {}
    if not data or not data.get('name') or not data.get('name').strip():
        errors['name'] = 'Event name is required'
    if not data or not data.get('start_time'):
        errors['start_time'] = 'Start time is required'
    
    if errors:
        return jsonify({'error': 'Validation failed', 'errors': errors}), 400
    
    # Parse datetime
    try:
        start_time = datetime.fromisoformat(data['start_time'].replace('Z', '+00:00'))
        end_time = None
        if data.get('end_time'):
            end_time = datetime.fromisoformat(data['end_time'].replace('Z', '+00:00'))
        
        # Parse end_date if provided
        end_date = None
        if data.get('end_date'):
            from datetime import date
            end_date = date.fromisoformat(data['end_date'])
    except ValueError as e:
        return jsonify({'error': f'Invalid date format: {str(e)}'}), 400
    
    event = Event(
        user_id=user.id,
        name=data['name'],
        description=data.get('description', ''),
        location=data.get('location', ''),
        start_time=start_time,
        end_time=end_time,
        end_date=end_date,
        order=data.get('order', 0),
        is_public=data.get('is_public', True),
        is_active=data.get('is_active', True),
        dress_code=data.get('dress_code', ''),
        notes=data.get('notes', '')
    )
    
    try:
        db.session.add(event)
        db.session.commit()
        return jsonify(event.to_dict()), 201
    except IntegrityError as e:
        db.session.rollback()
        import logging
        logger = logging.getLogger(__name__)
        logger.error(f"IntegrityError creating event: {e}", exc_info=True)
        return jsonify({'error': 'Failed to create event', 'details': str(e)}), 500
    except Exception as e:
        db.session.rollback()
        import logging
        logger = logging.getLogger(__name__)
        logger.error(f"Error creating event: {e}", exc_info=True)
        return jsonify({'error': 'Failed to create event', 'details': str(e)}), 500

@events_bp.route('/<int:event_id>', methods=['PUT'])
@jwt_required()
def update_event(event_id):
    """Update an event (admin/planner)"""
    user, err = require_roles(['admin', 'planner'])
    if err:
        return err
    
    event = Event.query.get_or_404(event_id)
    data = request.get_json()
    
    # Update fields
    if 'name' in data:
        event.name = data['name']
    if 'description' in data:
        event.description = data['description']
    if 'location' in data:
        event.location = data['location']
    if 'start_time' in data:
        try:
            event.start_time = datetime.fromisoformat(data['start_time'].replace('Z', '+00:00'))
        except ValueError:
            return jsonify({'error': 'Invalid start_time format'}), 400
    if 'end_time' in data:
        if data['end_time']:
            try:
                event.end_time = datetime.fromisoformat(data['end_time'].replace('Z', '+00:00'))
            except ValueError:
                return jsonify({'error': 'Invalid end_time format'}), 400
        else:
            event.end_time = None
    if 'end_date' in data:
        if data['end_date']:
            try:
                from datetime import date
                event.end_date = date.fromisoformat(data['end_date'])
            except ValueError:
                return jsonify({'error': 'Invalid end_date format'}), 400
        else:
            event.end_date = None
    if 'order' in data:
        event.order = data['order']
    if 'is_public' in data:
        event.is_public = data['is_public']
    if 'is_active' in data:
        event.is_active = data['is_active']
    if 'dress_code' in data:
        event.dress_code = data['dress_code']
    if 'notes' in data:
        event.notes = data['notes']
    
    try:
        db.session.commit()
        return jsonify(event.to_dict()), 200
    except IntegrityError:
        db.session.rollback()
        return jsonify({'error': 'Failed to update event'}), 500

@events_bp.route('/<int:event_id>', methods=['DELETE'])
@jwt_required()
def delete_event(event_id):
    """Delete an event (admin/planner)"""
    user, err = require_roles(['admin', 'planner'])
    if err:
        return err
    
    event = Event.query.get_or_404(event_id)
    
    try:
        db.session.delete(event)
        db.session.commit()
        return jsonify({'message': 'Event deleted successfully'}), 200
    except IntegrityError:
        db.session.rollback()
        return jsonify({'error': 'Failed to delete event'}), 500


def _upsert_public_content_key(key: str, title: str, content_en: str, content_de: str, content_fr: str):
    existing = Content.query.filter_by(key=key).first()
    if existing:
        existing.title = title
        existing.content_type = 'text'
        existing.is_public = True
        existing.content_en = content_en
        existing.content_de = content_de
        existing.content_fr = content_fr
        # legacy field
        existing.content = content_en
        return existing
    c = Content(
        key=key,
        title=title,
        content_type='text',
        is_public=True,
        content_en=content_en,
        content_de=content_de,
        content_fr=content_fr,
        content=content_en,
    )
    db.session.add(c)
    return c


@events_bp.route('/guest-portal-settings', methods=['GET'])
@jwt_required()
def get_guest_portal_settings():
    """Get guest-portal item settings (admin/planner) without opening full content editing."""
    user, err = require_roles(['admin', 'planner'])
    if err:
        return err

    keys = [
        'guest_event_gifts_event_id',
        'guest_event_gifts_event_label',
        'guest_event_gifts_timeline_details',
        'guest_timeline_venue_id',
        'guest_timeline_venue_name',
        'guest_timeline_venue_address',
        'guest_timeline_venue_city_region',
        'guest_agenda',
        'guest_dresscode',
        'guest_accommodation_venue_id',
        'guest_accommodation_venue_name',
        'guest_accommodation_venue_address',
        'guest_accommodation_venue_city_region',
        'guest_accommodation_venue_website',
        'guest_accommodation_details',
        'guest_accommodation_map_address',
        'guest_accommodation_booking_link',
        # Gift Registry
        'guest_gift_iban',
        'guest_gift_message',
        'guest_gift_account_holder',
        # Witnesses (Maid of Honor & Best Man)
        'guest_witnesses',
    ]
    items = {c.key: c for c in Content.query.filter(Content.key.in_(keys)).all()}

    def pack(key):
        c = items.get(key)
        return {
            'en': (c.content_en or c.content or '') if c else '',
            'de': (c.content_de or c.content or '') if c else '',
            'fr': (c.content_fr or c.content or '') if c else '',
        }

    def one(key):
        c = items.get(key)
        return (c.content_en or c.content or '') if c else ''

    return jsonify({
        'guestEventId': one('guest_event_gifts_event_id'),
        'guestEventLabel': pack('guest_event_gifts_event_label'),
        'guestEventDetails': pack('guest_event_gifts_timeline_details'),
        'guestTimelineVenueId': one('guest_timeline_venue_id'),
        'guestTimelineVenueName': pack('guest_timeline_venue_name'),
        'guestTimelineVenueAddress': pack('guest_timeline_venue_address'),
        'guestTimelineVenueCityRegion': pack('guest_timeline_venue_city_region'),
        'guestAgenda': pack('guest_agenda'),
        'guestDresscode': pack('guest_dresscode'),
        'guestAccommodationVenueId': one('guest_accommodation_venue_id'),
        'guestAccommodationVenueName': pack('guest_accommodation_venue_name'),
        'guestAccommodationVenueAddress': pack('guest_accommodation_venue_address'),
        'guestAccommodationVenueCityRegion': pack('guest_accommodation_venue_city_region'),
        'guestAccommodationVenueWebsite': pack('guest_accommodation_venue_website'),
        'guestAccommodationDetails': pack('guest_accommodation_details'),
        'guestAccommodationMapAddress': one('guest_accommodation_map_address'),
        'guestAccommodationBookingLink': one('guest_accommodation_booking_link'),
        # Gift Registry
        'giftIban': pack('guest_gift_iban'),
        'giftMessage': pack('guest_gift_message'),
        'giftAccountHolder': pack('guest_gift_account_holder'),
        # Witnesses (Maid of Honor & Best Man)
        'witnesses': one('guest_witnesses'),
    }), 200


@events_bp.route('/guest-portal-settings', methods=['POST'])
@jwt_required()
def set_guest_portal_settings():
    """Save guest-portal item settings (admin/planner)."""
    user, err = require_roles(['admin', 'planner'])
    if err:
        return err

    data = request.get_json() or {}
    guest_event_id = str(data.get('guestEventId') or '').strip()
    guest_event_details = data.get('guestEventDetails') or {}
    guest_timeline_venue_id = str(data.get('guestTimelineVenueId') or '').strip()
    guest_agenda = data.get('guestAgenda') or {}
    guest_dresscode = data.get('guestDresscode') or {}
    guest_accommodation_venue_id = str(data.get('guestAccommodationVenueId') or '').strip()
    guest_accommodation_details = data.get('guestAccommodationDetails') or {}
    guest_accommodation_booking_link = str(data.get('guestAccommodationBookingLink') or '').strip()
    
    # Gift Registry
    gift_iban = data.get('giftIban') or {}
    gift_message = data.get('giftMessage') or {}
    gift_account_holder = data.get('giftAccountHolder') or {}
    
    # Witnesses (Maid of Honor & Best Man)
    witnesses_json = str(data.get('witnesses') or '[]')

    selected_event = None
    if guest_event_id:
        try:
            selected_event = Event.query.get(int(guest_event_id))
        except Exception:
            selected_event = None

    # Timeline venue (for Wedding Programme)
    timeline_venue = None
    if guest_timeline_venue_id:
        try:
            timeline_venue = Venue.query.get(int(guest_timeline_venue_id))
        except Exception:
            timeline_venue = None

    # Accommodation venue (for Accommodation & Travel)
    accommodation_venue = None
    if guest_accommodation_venue_id:
        try:
            accommodation_venue = Venue.query.get(int(guest_accommodation_venue_id))
        except Exception:
            accommodation_venue = None

    def fmt_label(event: Event, locale: str):
        if not event or not event.start_time:
            return event.name if event else ''
        # Format in a stable way; timezone conversion is handled client-side for display anyway
        dt = event.start_time
        date = dt.strftime('%Y-%m-%d')
        time = dt.strftime('%H:%M')
        return f"{event.name} — {date} {time}"

    # Featured event settings
    _upsert_public_content_key(
        'guest_event_gifts_event_id',
        'Guest: Featured event id',
        guest_event_id, guest_event_id, guest_event_id
    )
    _upsert_public_content_key(
        'guest_event_gifts_event_label',
        'Guest: Featured event label',
        fmt_label(selected_event, 'en-US') if selected_event else '',
        fmt_label(selected_event, 'de-CH') if selected_event else '',
        fmt_label(selected_event, 'fr-CH') if selected_event else '',
    )
    _upsert_public_content_key(
        'guest_event_gifts_timeline_details',
        'Guest: Additional timeline notes',
        str(guest_event_details.get('en') or ''),
        str(guest_event_details.get('de') or ''),
        str(guest_event_details.get('fr') or ''),
    )

    # Timeline venue settings (for Wedding Programme)
    _upsert_public_content_key(
        'guest_timeline_venue_id',
        'Guest: Timeline venue id',
        guest_timeline_venue_id, guest_timeline_venue_id, guest_timeline_venue_id
    )
    _upsert_public_content_key(
        'guest_timeline_venue_name',
        'Guest: Timeline venue name',
        (timeline_venue.name if timeline_venue else ''),
        (timeline_venue.name if timeline_venue else ''),
        (timeline_venue.name if timeline_venue else ''),
    )
    _upsert_public_content_key(
        'guest_timeline_venue_address',
        'Guest: Timeline venue address',
        (timeline_venue.address if timeline_venue else ''),
        (timeline_venue.address if timeline_venue else ''),
        (timeline_venue.address if timeline_venue else ''),
    )
    timeline_city_region = ''
    if timeline_venue:
        if timeline_venue.city and timeline_venue.region:
            timeline_city_region = f"{timeline_venue.city}, {timeline_venue.region}"
        else:
            timeline_city_region = timeline_venue.location or timeline_venue.city or ''
    _upsert_public_content_key(
        'guest_timeline_venue_city_region',
        'Guest: Timeline venue city/region',
        timeline_city_region, timeline_city_region, timeline_city_region
    )

    # Detailed agenda (multilingual)
    _upsert_public_content_key(
        'guest_agenda',
        'Guest: Detailed agenda',
        str(guest_agenda.get('en') or ''),
        str(guest_agenda.get('de') or ''),
        str(guest_agenda.get('fr') or ''),
    )

    # Dresscode (multilingual)
    _upsert_public_content_key(
        'guest_dresscode',
        'Guest: Dresscode',
        str(guest_dresscode.get('en') or ''),
        str(guest_dresscode.get('de') or ''),
        str(guest_dresscode.get('fr') or ''),
    )

    # Accommodation venue settings
    _upsert_public_content_key(
        'guest_accommodation_venue_id',
        'Guest: Accommodation venue id',
        guest_accommodation_venue_id, guest_accommodation_venue_id, guest_accommodation_venue_id
    )
    _upsert_public_content_key(
        'guest_accommodation_venue_name',
        'Guest: Accommodation venue name',
        (accommodation_venue.name if accommodation_venue else ''),
        (accommodation_venue.name if accommodation_venue else ''),
        (accommodation_venue.name if accommodation_venue else ''),
    )
    _upsert_public_content_key(
        'guest_accommodation_venue_address',
        'Guest: Accommodation venue address',
        (accommodation_venue.address if accommodation_venue else ''),
        (accommodation_venue.address if accommodation_venue else ''),
        (accommodation_venue.address if accommodation_venue else ''),
    )
    accommodation_city_region = ''
    if accommodation_venue:
        if accommodation_venue.city and accommodation_venue.region:
            accommodation_city_region = f"{accommodation_venue.city}, {accommodation_venue.region}"
        else:
            accommodation_city_region = accommodation_venue.location or accommodation_venue.city or ''
    _upsert_public_content_key(
        'guest_accommodation_venue_city_region',
        'Guest: Accommodation venue city/region',
        accommodation_city_region, accommodation_city_region, accommodation_city_region
    )
    _upsert_public_content_key(
        'guest_accommodation_venue_website',
        'Guest: Accommodation venue website',
        (accommodation_venue.website if accommodation_venue else ''),
        (accommodation_venue.website if accommodation_venue else ''),
        (accommodation_venue.website if accommodation_venue else ''),
    )
    _upsert_public_content_key(
        'guest_accommodation_details',
        'Guest: Accommodation details',
        str(guest_accommodation_details.get('en') or ''),
        str(guest_accommodation_details.get('de') or ''),
        str(guest_accommodation_details.get('fr') or ''),
    )

    # Build full map address for Google Maps embed
    map_address = ''
    if accommodation_venue:
        parts = []
        if accommodation_venue.name:
            parts.append(accommodation_venue.name)
        if accommodation_venue.address:
            parts.append(accommodation_venue.address)
        if accommodation_venue.city:
            parts.append(accommodation_venue.city)
        if accommodation_venue.region:
            parts.append(accommodation_venue.region)
        map_address = ', '.join(parts)
    _upsert_public_content_key(
        'guest_accommodation_map_address',
        'Guest: Accommodation map address (for Google Maps)',
        map_address, map_address, map_address
    )
    _upsert_public_content_key(
        'guest_accommodation_booking_link',
        'Guest: Accommodation booking link',
        guest_accommodation_booking_link, guest_accommodation_booking_link, guest_accommodation_booking_link
    )

    # Gift Registry
    _upsert_public_content_key(
        'guest_gift_iban',
        'Guest: Gift IBAN',
        str(gift_iban.get('en') or ''),
        str(gift_iban.get('de') or ''),
        str(gift_iban.get('fr') or ''),
    )
    _upsert_public_content_key(
        'guest_gift_message',
        'Guest: Gift message',
        str(gift_message.get('en') or ''),
        str(gift_message.get('de') or ''),
        str(gift_message.get('fr') or ''),
    )
    _upsert_public_content_key(
        'guest_gift_account_holder',
        'Guest: Gift account holder',
        str(gift_account_holder.get('en') or ''),
        str(gift_account_holder.get('de') or ''),
        str(gift_account_holder.get('fr') or ''),
    )

    # Witnesses (Maid of Honor & Best Man) - same JSON for all languages
    _upsert_public_content_key(
        'guest_witnesses',
        'Guest: Witnesses (Maid of Honor & Best Man)',
        witnesses_json, witnesses_json, witnesses_json
    )

    try:
        db.session.commit()
        return jsonify({'ok': True}), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': 'Failed to save guest portal settings', 'details': str(e)}), 500

