from datetime import datetime, timedelta

from flask import Blueprint, jsonify, request
from flask_jwt_extended import jwt_required

from src.models import Content, Event, Task, db
from src.utils.rbac import require_roles

onboarding_bp = Blueprint('onboarding', __name__)

MAX_TEXT_FIELD_LENGTH = 300
MAX_STYLE_NOTE_LENGTH = 1000

DEFAULTS = {
    'couple_names': 'Your Couple',
    'wedding_location': 'Your dream venue',
    'planner_brand': 'Wedding Planner Studio',
    'wedding_hashtag': '#OurBigDay',
    'style_note': 'Elegant, warm and deeply personal.',
}


def _upsert_content(key, title, value, order, is_public=True):
    item = Content.query.filter_by(key=key).first()
    if item:
        item.title = title
        item.content = value
        item.content_en = value
        item.is_public = is_public
        item.order = order
        item.updated_at = datetime.utcnow()
        return item, False

    item = Content(
        key=key,
        title=title,
        content=value,
        content_en=value,
        is_public=is_public,
        order=order,
        published_at=datetime.utcnow() if is_public else None,
    )
    db.session.add(item)
    return item, True


def _clean_text(value, fallback='', max_len=MAX_TEXT_FIELD_LENGTH):
    text = (value or '').strip()
    if not text:
        text = fallback
    return text[:max_len]


def _parse_wedding_date(raw_value):
    value = (raw_value or '').strip()
    if not value:
        return datetime.utcnow() + timedelta(days=180)

    normalized = value.replace('Z', '+00:00')
    try:
        return datetime.fromisoformat(normalized)
    except ValueError:
        raise ValueError('wedding_date must be ISO format, e.g. 2027-06-18T15:30:00')


def _build_content_template(couple_names, formatted_date, wedding_location, planner_brand, wedding_hashtag, style_note, wedding_date):
    return [
        ('welcome', 'Welcome', f'Welcome to {couple_names} wedding experience.'),
        ('joinOurCelebration', 'Hero subtitle', f'Join {couple_names} on {formatted_date} in {wedding_location}.'),
        ('introduction', 'Introduction', f"{planner_brand} created this space so each guest has a smooth, premium wedding journey. {style_note}"),
        ('ourStory', 'Our Story', f'{couple_names} are building a celebration that reflects their story, style and favorite people.'),
        ('guestInfoSubtitle', 'Guest info subtitle', 'Everything your guests need: RSVP, timeline, logistics, gifts, and photos - all in one place.'),
        ('contactCoupleDescription', 'Contact description', f'Questions, ideas, or special needs? Reach out anytime. {planner_brand} keeps communication centralized so nothing gets lost.'),
        ('travelSectionTitle', 'Travel section title', f'Traveling to {wedding_location}'),
        ('giftRegistryIntro', 'Gift intro', f'Your presence means the most. If you wish, you can also support {couple_names} through the selected gifts and experiences.'),
        ('wedding_hashtag', 'Wedding hashtag', wedding_hashtag),
        ('wedding_date_iso', 'Wedding date ISO', wedding_date.isoformat()),
        ('attendanceVenueHint', 'Venue hint', wedding_location),
    ]


def _build_event_template(wedding_date, wedding_location):
    return [
        ('Guest arrival & welcome drink', 'Kick off the experience with music and a welcome toast.', wedding_date.replace(hour=15, minute=0), wedding_location),
        ('Ceremony', 'The emotional centerpiece of the day.', wedding_date.replace(hour=16, minute=30), wedding_location),
        ('Dinner & speeches', 'Dinner service, speeches and shared memories.', wedding_date.replace(hour=18, minute=0), wedding_location),
        ('Party & dance floor', 'Open dance floor, DJ and celebration.', wedding_date.replace(hour=21, minute=0), wedding_location),
    ]


def _build_task_template():
    return [
        ('Define couple vision board and color palette', 'decoration', 'high', 120),
        ('Finalize guest list and invitation wave #1', 'guests', 'urgent', 90),
        ('Secure venue + catering contract', 'venue', 'urgent', 80),
        ('Build ceremony timeline and vendor run sheet', 'planning', 'high', 45),
        ('Confirm seating chart draft', 'guests', 'medium', 14),
    ]


@onboarding_bp.route('/quick-setup', methods=['POST'])
@jwt_required()
def quick_setup():
    """Starter setup with reusable templates for wedding projects."""
    user, err = require_roles(['admin', 'planner', 'super_admin'])
    if err:
        return err

    data = request.get_json() or {}

    try:
        wedding_date = _parse_wedding_date(data.get('wedding_date'))
    except ValueError:
        return jsonify({'error': 'wedding_date must be ISO format, e.g. 2027-06-18T15:30:00'}), 400

    couple_names = _clean_text(data.get('couple_names'), fallback=DEFAULTS['couple_names'])
    wedding_location = _clean_text(data.get('wedding_location'), fallback=DEFAULTS['wedding_location'])
    planner_brand = _clean_text(data.get('planner_brand'), fallback=DEFAULTS['planner_brand'])
    wedding_hashtag = _clean_text(data.get('wedding_hashtag'), fallback=DEFAULTS['wedding_hashtag'])
    style_note = _clean_text(
        data.get('style_note'),
        fallback=DEFAULTS['style_note'],
        max_len=MAX_STYLE_NOTE_LENGTH,
    )

    formatted_date = wedding_date.strftime('%d %B %Y')

    content_blueprint = _build_content_template(
        couple_names=couple_names,
        formatted_date=formatted_date,
        wedding_location=wedding_location,
        planner_brand=planner_brand,
        wedding_hashtag=wedding_hashtag,
        style_note=style_note,
        wedding_date=wedding_date,
    )

    created_content = 0
    updated_content = 0
    for idx, (key, title, value) in enumerate(content_blueprint):
        _, created = _upsert_content(key, title, value, idx)
        if created:
            created_content += 1
        else:
            updated_content += 1

    existing_events = Event.query.filter_by(user_id=user.id).count()
    created_events = 0
    if existing_events == 0 or data.get('force_seed_events'):
        event_templates = _build_event_template(wedding_date, wedding_location)
        for order, (name, description, start_time, location) in enumerate(event_templates):
            db.session.add(Event(
                user_id=user.id,
                name=name,
                description=description,
                start_time=start_time,
                location=location,
                order=order,
                is_public=True,
                is_active=True,
            ))
            created_events += 1

    existing_tasks = Task.query.filter_by(user_id=user.id).count()
    created_tasks = 0
    if existing_tasks == 0 or data.get('force_seed_tasks'):
        task_templates = _build_task_template()
        for title, category, priority, days_before in task_templates:
            db.session.add(Task(
                user_id=user.id,
                title=title,
                category=category,
                priority=priority,
                status='todo',
                due_date=(wedding_date - timedelta(days=days_before)).date(),
            ))
            created_tasks += 1

    db.session.commit()

    return jsonify({
        'message': 'Quick setup completed',
        'content': {'created': created_content, 'updated': updated_content},
        'events': {'created': created_events, 'existing': existing_events},
        'tasks': {'created': created_tasks, 'existing': existing_tasks},
    }), 200
