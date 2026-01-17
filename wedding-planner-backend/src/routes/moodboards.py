import os
import json
from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required
from src.models import db, Moodboard, User
from src.utils.jwt_helpers import get_admin_id


moodboards_bp = Blueprint('moodboards', __name__)


def _require_admin():
    user_id = get_admin_id()
    if not user_id:
        return None, (jsonify({'error': 'Unauthorized - Admin access required'}), 403)
    user = User.query.get(user_id)
    if not user or user.role != 'admin':
        return None, (jsonify({'error': 'Unauthorized'}), 403)
    return user_id, None


def _validate_content_json_size(raw: str):
    """
    Guardrail: prevent giant moodboard payloads (especially if someone tries to inline huge base64).
    """
    try:
        max_kb = int(os.getenv('MAX_MOODBOARD_JSON_KB', '1024'))  # 1MB default
    except ValueError:
        max_kb = 1024
    size = len((raw or '').encode('utf-8'))
    if size > max_kb * 1024:
        return False, f'contentJson is too large (>{max_kb}KB). Please remove large images or upload smaller files.'
    return True, None


@moodboards_bp.route('/api/moodboards', methods=['GET'])
@jwt_required()
def list_moodboards():
    user_id, err = _require_admin()
    if err:
        return err
    boards = Moodboard.query.filter_by(owner_id=user_id).order_by(Moodboard.updated_at.desc()).all()
    return jsonify([b.to_dict(include_content=False) for b in boards]), 200


@moodboards_bp.route('/api/moodboards', methods=['POST'])
@jwt_required()
def create_moodboard():
    user_id, err = _require_admin()
    if err:
        return err
    data = request.get_json(silent=True) or {}
    title = (data.get('title') or 'Main Moodboard').strip()
    if not title:
        title = 'Main Moodboard'
    board = Moodboard(owner_id=user_id, title=title, content_json=None)
    db.session.add(board)
    db.session.commit()
    return jsonify(board.to_dict(include_content=True)), 201


@moodboards_bp.route('/api/moodboards/<int:board_id>', methods=['GET'])
@jwt_required()
def get_moodboard(board_id: int):
    user_id, err = _require_admin()
    if err:
        return err
    board = Moodboard.query.get_or_404(board_id)
    if board.owner_id != user_id:
        return jsonify({'error': 'Not found'}), 404
    return jsonify(board.to_dict(include_content=True)), 200


@moodboards_bp.route('/api/moodboards/<int:board_id>', methods=['PUT'])
@jwt_required()
def update_moodboard(board_id: int):
    user_id, err = _require_admin()
    if err:
        return err
    board = Moodboard.query.get_or_404(board_id)
    if board.owner_id != user_id:
        return jsonify({'error': 'Not found'}), 404

    data = request.get_json(silent=True) or {}

    if 'title' in data:
        title = (data.get('title') or '').strip()
        if title:
            board.title = title

    if 'contentJson' in data:
        raw = data.get('contentJson')
        if raw is None:
            board.content_json = None
        elif isinstance(raw, (dict, list)):
            raw = json.dumps(raw)
            ok, msg = _validate_content_json_size(raw)
            if not ok:
                return jsonify({'error': msg}), 413
            board.content_json = raw
        elif isinstance(raw, str):
            ok, msg = _validate_content_json_size(raw)
            if not ok:
                return jsonify({'error': msg}), 413
            # Ensure it's valid JSON (best effort)
            try:
                json.loads(raw)
            except Exception:
                return jsonify({'error': 'contentJson must be valid JSON'}), 400
            board.content_json = raw
        else:
            return jsonify({'error': 'contentJson must be a JSON string/object/array'}), 400

    db.session.commit()
    return jsonify(board.to_dict(include_content=True)), 200


@moodboards_bp.route('/api/moodboards/<int:board_id>', methods=['DELETE'])
@jwt_required()
def delete_moodboard(board_id: int):
    user_id, err = _require_admin()
    if err:
        return err
    board = Moodboard.query.get_or_404(board_id)
    if board.owner_id != user_id:
        return jsonify({'error': 'Not found'}), 404
    db.session.delete(board)
    db.session.commit()
    return jsonify({'message': 'Moodboard deleted successfully'}), 200

