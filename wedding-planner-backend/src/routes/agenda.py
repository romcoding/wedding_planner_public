from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required
from models import db, AgendaItem, User
from utils.rbac import require_roles
from sqlalchemy.exc import IntegrityError

agenda_bp = Blueprint('agenda', __name__)


@agenda_bp.route('', methods=['GET'])
def get_agenda_items():
    """Get all active agenda items (public endpoint for guests)"""
    items = AgendaItem.query.filter_by(is_active=True).order_by(AgendaItem.order, AgendaItem.time_display).all()
    return jsonify([item.to_dict() for item in items]), 200


@agenda_bp.route('/admin', methods=['GET'])
@jwt_required()
def get_all_agenda_items():
    """Get all agenda items including inactive (admin only)"""
    user, err = require_roles(['admin', 'planner'])
    if err:
        return err
    
    items = AgendaItem.query.order_by(AgendaItem.order, AgendaItem.time_display).all()
    return jsonify([item.to_dict() for item in items]), 200


@agenda_bp.route('', methods=['POST'])
@jwt_required()
def create_agenda_item():
    """Create a new agenda item (admin/planner)"""
    user, err = require_roles(['admin', 'planner'])
    if err:
        return err

    data = request.get_json()

    # Validate required fields
    if not data or not data.get('time_display') or not data.get('time_display').strip():
        return jsonify({'error': 'Time is required'}), 400
    if not data.get('title_en') or not data.get('title_en').strip():
        return jsonify({'error': 'Title (English) is required'}), 400

    # Get max order for new item
    max_order = db.session.query(db.func.max(AgendaItem.order)).scalar() or 0

    item = AgendaItem(
        user_id=user.id,
        time_display=data['time_display'].strip(),
        title_en=data['title_en'].strip(),
        title_de=data.get('title_de', '').strip() or None,
        title_fr=data.get('title_fr', '').strip() or None,
        description_en=data.get('description_en', '').strip() or None,
        description_de=data.get('description_de', '').strip() or None,
        description_fr=data.get('description_fr', '').strip() or None,
        icon=data.get('icon', '').strip() or None,
        order=data.get('order', max_order + 1),
        is_active=data.get('is_active', True),
    )

    try:
        db.session.add(item)
        db.session.commit()
        return jsonify(item.to_dict()), 201
    except IntegrityError as e:
        db.session.rollback()
        return jsonify({'error': 'Failed to create agenda item', 'details': str(e)}), 500


@agenda_bp.route('/<int:item_id>', methods=['PUT'])
@jwt_required()
def update_agenda_item(item_id):
    """Update an agenda item (admin/planner)"""
    user, err = require_roles(['admin', 'planner'])
    if err:
        return err

    item = AgendaItem.query.get_or_404(item_id)
    data = request.get_json()

    # Update fields
    if 'time_display' in data:
        item.time_display = data['time_display'].strip()
    if 'title_en' in data:
        item.title_en = data['title_en'].strip()
    if 'title_de' in data:
        item.title_de = data['title_de'].strip() or None
    if 'title_fr' in data:
        item.title_fr = data['title_fr'].strip() or None
    if 'description_en' in data:
        item.description_en = data['description_en'].strip() or None
    if 'description_de' in data:
        item.description_de = data['description_de'].strip() or None
    if 'description_fr' in data:
        item.description_fr = data['description_fr'].strip() or None
    if 'icon' in data:
        item.icon = data['icon'].strip() or None
    if 'order' in data:
        item.order = data['order']
    if 'is_active' in data:
        item.is_active = data['is_active']

    try:
        db.session.commit()
        return jsonify(item.to_dict()), 200
    except IntegrityError:
        db.session.rollback()
        return jsonify({'error': 'Failed to update agenda item'}), 500


@agenda_bp.route('/<int:item_id>', methods=['DELETE'])
@jwt_required()
def delete_agenda_item(item_id):
    """Delete an agenda item (admin/planner)"""
    user, err = require_roles(['admin', 'planner'])
    if err:
        return err

    item = AgendaItem.query.get_or_404(item_id)

    try:
        db.session.delete(item)
        db.session.commit()
        return jsonify({'message': 'Agenda item deleted successfully'}), 200
    except IntegrityError:
        db.session.rollback()
        return jsonify({'error': 'Failed to delete agenda item'}), 500


@agenda_bp.route('/reorder', methods=['POST'])
@jwt_required()
def reorder_agenda_items():
    """Reorder agenda items (admin/planner)"""
    user, err = require_roles(['admin', 'planner'])
    if err:
        return err

    data = request.get_json()
    if not data or 'items' not in data:
        return jsonify({'error': 'Items array is required'}), 400

    try:
        for idx, item_data in enumerate(data['items']):
            item_id = item_data.get('id')
            if item_id:
                item = AgendaItem.query.get(item_id)
                if item:
                    item.order = idx
        db.session.commit()
        return jsonify({'message': 'Reordered successfully'}), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': 'Failed to reorder', 'details': str(e)}), 500
