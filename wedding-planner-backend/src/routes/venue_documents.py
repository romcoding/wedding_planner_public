"""
Routes for venue document upload and management
"""
import os
import json
from flask import Blueprint, request, jsonify, send_file
from flask_jwt_extended import jwt_required, get_jwt_identity
from werkzeug.utils import secure_filename
from src.models import db, Venue, VenueDocument, DocumentChunk, User
from src.utils.jwt_helpers import get_admin_id
from src.services.document_parser import parse_document, chunk_text
from src.services.embedding_service import get_embeddings_batch
import logging

logger = logging.getLogger(__name__)

documents_bp = Blueprint('venue_documents', __name__)

# Allowed file extensions
ALLOWED_EXTENSIONS = {'pdf', 'docx', 'doc'}
UPLOAD_FOLDER = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(__file__))), 'uploads', 'documents')

# Ensure upload directory exists
os.makedirs(UPLOAD_FOLDER, exist_ok=True)


def allowed_file(filename):
    return '.' in filename and filename.rsplit('.', 1)[1].lower() in ALLOWED_EXTENSIONS


@documents_bp.route('/venues/<int:venue_id>/documents', methods=['GET'])
@jwt_required()
def get_documents(venue_id):
    """Get all documents for a venue"""
    user_id = get_jwt_identity()
    user = User.query.get(user_id)
    
    if not user or user.role != 'admin':
        return jsonify({'error': 'Unauthorized'}), 403
    
    venue = Venue.query.get(venue_id)
    if not venue or venue.user_id != user_id:
        return jsonify({'error': 'Venue not found'}), 404
    
    documents = VenueDocument.query.filter_by(venue_id=venue_id).order_by(VenueDocument.created_at.desc()).all()
    return jsonify([doc.to_dict() for doc in documents]), 200


@documents_bp.route('/venues/<int:venue_id>/documents', methods=['POST'])
@jwt_required()
def upload_document(venue_id):
    """Upload a document for a venue"""
    user_id = get_jwt_identity()
    user = User.query.get(user_id)
    
    if not user or user.role != 'admin':
        return jsonify({'error': 'Unauthorized'}), 403
    
    venue = Venue.query.get(venue_id)
    if not venue or venue.user_id != user_id:
        return jsonify({'error': 'Venue not found'}), 404
    
    if 'file' not in request.files:
        return jsonify({'error': 'No file provided'}), 400
    
    file = request.files['file']
    if file.filename == '':
        return jsonify({'error': 'No file selected'}), 400
    
    if not allowed_file(file.filename):
        return jsonify({'error': 'File type not allowed. Only PDF and DOCX files are supported.'}), 400
    
    try:
        # Save file
        filename = secure_filename(file.filename)
        # Add timestamp to avoid collisions
        import time
        timestamp = int(time.time())
        safe_filename = f"{timestamp}_{filename}"
        file_path = os.path.join(UPLOAD_FOLDER, safe_filename)
        file.save(file_path)
        
        # Get file size
        file_size = os.path.getsize(file_path)
        
        # Create document record
        document = VenueDocument(
            venue_id=venue_id,
            user_id=user_id,
            filename=safe_filename,
            original_filename=filename,
            file_path=file_path,
            file_size=file_size,
            mime_type=file.content_type,
            status='uploaded',
            uploaded_by=user.email or user.username
        )
        
        db.session.add(document)
        db.session.flush()  # Get document.id
        
        # Process document asynchronously (for now, process synchronously)
        try:
            document.status = 'processing'
            db.session.commit()
            
            # Parse document
            extracted_text = parse_document(file_path, file.content_type)
            if not extracted_text:
                raise ValueError("No text extracted from document")
            
            document.extracted_text = extracted_text
            document.status = 'processed'
            
            # Create chunks
            chunks = chunk_text(extracted_text, chunk_size=1000, overlap=200)
            
            # Get embeddings for chunks
            chunk_texts = [chunk[1] for chunk in chunks]
            embeddings = get_embeddings_batch(chunk_texts)
            
            # Create chunk records
            chunk_objects = []
            for i, (chunk_index, chunk_text) in enumerate(chunks):
                embedding = embeddings[i] if i < len(embeddings) and embeddings[i] else None
                chunk = DocumentChunk(
                    document_id=document.id,
                    chunk_index=chunk_index,
                    text=chunk_text,
                    text_length=len(chunk_text),
                    embedding=json.dumps(embedding) if embedding else None
                )
                chunk_objects.append(chunk)
            
            db.session.bulk_save_objects(chunk_objects)
            document.chunk_count = len(chunks)
            db.session.commit()
            
            return jsonify(document.to_dict()), 201
            
        except Exception as e:
            logger.error(f"Error processing document: {e}")
            document.status = 'error'
            document.error_message = str(e)
            db.session.commit()
            return jsonify({'error': f'Failed to process document: {str(e)}'}), 500
        
    except Exception as e:
        db.session.rollback()
        logger.error(f"Error uploading document: {e}")
        return jsonify({'error': f'Failed to upload document: {str(e)}'}), 500


@documents_bp.route('/venues/<int:venue_id>/documents/<int:document_id>', methods=['PUT'])
@jwt_required()
def update_document(venue_id, document_id):
    """Update document metadata (notes, etc.)"""
    user_id = get_jwt_identity()
    user = User.query.get(user_id)
    
    if not user or user.role != 'admin':
        return jsonify({'error': 'Unauthorized'}), 403
    
    document = VenueDocument.query.filter_by(id=document_id, venue_id=venue_id).first()
    if not document:
        return jsonify({'error': 'Document not found'}), 404
    
    data = request.get_json()
    if 'notes' in data:
        document.notes = data.get('notes', '')
    
    try:
        db.session.commit()
        return jsonify(document.to_dict()), 200
    except Exception as e:
        db.session.rollback()
        logger.error(f"Error updating document: {e}")
        return jsonify({'error': f'Failed to update document: {str(e)}'}), 500


@documents_bp.route('/venues/<int:venue_id>/documents/<int:document_id>', methods=['DELETE'])
@jwt_required()
def delete_document(venue_id, document_id):
    """Delete a document"""
    user_id = get_jwt_identity()
    user = User.query.get(user_id)
    
    if not user or user.role != 'admin':
        return jsonify({'error': 'Unauthorized'}), 403
    
    document = VenueDocument.query.filter_by(id=document_id, venue_id=venue_id).first()
    if not document:
        return jsonify({'error': 'Document not found'}), 404
    
    try:
        # Delete file
        if os.path.exists(document.file_path):
            os.remove(document.file_path)
        
        # Delete document (cascades to chunks)
        db.session.delete(document)
        db.session.commit()
        return jsonify({'message': 'Document deleted successfully'}), 200
    except Exception as e:
        db.session.rollback()
        logger.error(f"Error deleting document: {e}")
        return jsonify({'error': f'Failed to delete document: {str(e)}'}), 500
