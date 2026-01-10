"""
Routes for venue chat functionality
"""
from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
from src.models import db, Venue, VenueChatHistory, User
from src.services.venue_chat_service import generate_chat_response
import logging

logger = logging.getLogger(__name__)

chat_bp = Blueprint('venue_chat', __name__)


@chat_bp.route('/venues/<int:venue_id>/chat', methods=['POST'])
@jwt_required()
def chat(venue_id):
    """Chat with venue using RAG"""
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
    if not data or not data.get('message'):
        return jsonify({'error': 'Message is required'}), 400
    
    user_message = data['message']
    session_id = data.get('session_id')
    model = data.get('model', 'gpt-5-mini')  # Use latest GPT-5-mini model (best balance)
    
    try:
        # Get conversation history if session_id provided
        conversation_history = []
        if session_id:
            history = VenueChatHistory.query.filter_by(
                venue_id=venue_id,
                session_id=session_id
            ).order_by(VenueChatHistory.created_at).all()
            conversation_history = [msg.to_dict() for msg in history]
        
        # Save user message
        user_chat = VenueChatHistory(
            venue_id=venue_id,
            user_id=user_id,
            session_id=session_id,
            message_type='user',
            message=user_message
        )
        db.session.add(user_chat)
        db.session.flush()
        
        # Generate response
        response = generate_chat_response(
            venue_id=venue_id,
            user_query=user_message,
            conversation_history=conversation_history,
            model=model
        )
        
        # Save assistant response
        assistant_chat = VenueChatHistory(
            venue_id=venue_id,
            user_id=user_id,
            session_id=session_id,
            message_type='assistant',
            message=response['message'],
            citations=json.dumps(response['citations']) if response['citations'] else None,
            tokens_used=response['tokens_used'],
            model_used=response['model_used']
        )
        db.session.add(assistant_chat)
        db.session.commit()
        
        return jsonify({
            'message': response['message'],
            'citations': response['citations'],
            'session_id': session_id,
            'tokens_used': response['tokens_used'],
            'model_used': response['model_used']
        }), 200
        
    except Exception as e:
        db.session.rollback()
        logger.error(f"Error in chat: {e}")
        return jsonify({'error': f'Failed to process chat: {str(e)}'}), 500


@chat_bp.route('/venues/<int:venue_id>/chat/history', methods=['GET'])
@jwt_required()
def get_chat_history(venue_id):
    """Get chat history for a venue"""
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
    
    session_id = request.args.get('session_id')
    limit = request.args.get('limit', type=int, default=50)
    
    query = VenueChatHistory.query.filter_by(venue_id=venue_id)
    if session_id:
        query = query.filter_by(session_id=session_id)
    
    history = query.order_by(VenueChatHistory.created_at.desc()).limit(limit).all()
    return jsonify([msg.to_dict() for msg in reversed(history)]), 200
