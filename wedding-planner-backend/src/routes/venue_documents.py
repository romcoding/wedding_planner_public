"""
Routes for venue document upload and management
"""
import os
import json
import threading
from flask import Blueprint, request, jsonify, send_file, current_app
from flask_jwt_extended import jwt_required, get_jwt_identity
from werkzeug.utils import secure_filename
from src.models import db, Venue, VenueDocument, DocumentChunk, User
from src.services.document_parser import parse_document, chunk_text
from src.services.embedding_service import get_embeddings_batch
import logging

logger = logging.getLogger(__name__)

documents_bp = Blueprint('venue_documents', __name__)

# Allowed file extensions
ALLOWED_EXTENSIONS = {'pdf', 'docx', 'doc'}
UPLOAD_FOLDER = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(__file__))), 'uploads', 'documents')
MAX_FILE_SIZE_MB = int(os.getenv('MAX_VENUE_DOC_MB', '25'))
MAX_EXTRACTED_CHARS = int(os.getenv('MAX_VENUE_DOC_EXTRACTED_CHARS', '300000'))
MAX_CHUNKS = int(os.getenv('MAX_VENUE_DOC_CHUNKS', '300'))
EMBEDDING_BATCH_SIZE = int(os.getenv('VENUE_DOC_EMBEDDING_BATCH_SIZE', '50'))

# Ensure upload directory exists
os.makedirs(UPLOAD_FOLDER, exist_ok=True)


def allowed_file(filename):
    return '.' in filename and filename.rsplit('.', 1)[1].lower() in ALLOWED_EXTENSIONS


def _process_document_in_background(app, document_id: int, file_path: str, mime_type: str):
    """
    Heavy processing (pdf/docx parse + chunk + embeddings) in a background thread.
    This avoids Render request timeouts/502s during upload.
    """
    with app.app_context():
        try:
            document = VenueDocument.query.get(document_id)
            if not document:
                logger.error(f"Background processing: document {document_id} not found")
                return

            # Parse document
            extracted_text = parse_document(file_path, mime_type)
            if not extracted_text:
                raise ValueError("No text extracted from document")

            # Cap extracted text to keep processing bounded
            if len(extracted_text) > MAX_EXTRACTED_CHARS:
                extracted_text = extracted_text[:MAX_EXTRACTED_CHARS]
                document.error_message = (document.error_message or "") + f" Extracted text truncated to {MAX_EXTRACTED_CHARS} chars."

            document.extracted_text = extracted_text

            # Chunk
            chunks = chunk_text(extracted_text, chunk_size=1000, overlap=200)
            if not chunks:
                raise ValueError("No chunks created from document text")

            if len(chunks) > MAX_CHUNKS:
                chunks = chunks[:MAX_CHUNKS]
                document.error_message = (document.error_message or "") + f" Chunks truncated to {MAX_CHUNKS}."

            chunk_texts = [chunk_text_content for _, chunk_text_content in chunks]

            # Embeddings in bounded batches
            embeddings: list = []
            for i in range(0, len(chunk_texts), EMBEDDING_BATCH_SIZE):
                batch = chunk_texts[i:i + EMBEDDING_BATCH_SIZE]
                embeddings.extend(get_embeddings_batch(batch))

            # Replace old chunks if any (re-upload/reprocess)
            DocumentChunk.query.filter_by(document_id=document.id).delete()
            db.session.flush()

            chunk_objects = []
            for i, (chunk_index, chunk_text_content) in enumerate(chunks):
                embedding = embeddings[i] if i < len(embeddings) else None
                chunk_objects.append(DocumentChunk(
                    document_id=document.id,
                    chunk_index=chunk_index,
                    text=chunk_text_content,
                    text_length=len(chunk_text_content),
                    embedding=json.dumps(embedding) if embedding else None
                ))

            db.session.bulk_save_objects(chunk_objects)
            document.chunk_count = len(chunk_objects)
            document.status = 'processed'
            db.session.commit()
        except MemoryError as e:
            # Be explicit — Render may still kill the process, but if it doesn't,
            # we at least persist a clear error.
            logger.error(f"Background document processing OOM: {e}")
            try:
                document = VenueDocument.query.get(document_id)
                if document:
                    document.status = 'error'
                    document.error_message = (
                        'Out of memory while processing document. '
                        'Try a smaller PDF or reduce MAX_PDF_PAGES.'
                    )
                    db.session.commit()
            except Exception as inner:
                logger.error(f"Failed to persist background OOM status: {inner}")
                db.session.rollback()
        except Exception as e:
            logger.error(f"Background document processing failed: {e}")
            try:
                document = VenueDocument.query.get(document_id)
                if document:
                    document.status = 'error'
                    document.error_message = str(e)
                    db.session.commit()
            except Exception as inner:
                logger.error(f"Failed to persist background error status: {inner}")
                db.session.rollback()
        finally:
            try:
                db.session.remove()
            except Exception:
                pass


@documents_bp.route('/venues/<int:venue_id>/documents', methods=['GET'])
@jwt_required()
def get_documents(venue_id):
    """Get all documents for a venue"""
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
    if not venue:
        return jsonify({'error': 'Venue not found'}), 404
    # Allow admin to access any venue
    if venue.user_id != user_id and user.role != 'admin':
        return jsonify({'error': 'Unauthorized'}), 403
    
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
        if file_size > MAX_FILE_SIZE_MB * 1024 * 1024:
            # Clean up saved file
            try:
                os.remove(file_path)
            except Exception:
                pass
            return jsonify({'error': f'File too large. Max {MAX_FILE_SIZE_MB}MB.'}), 413
        
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
        
        # Set initial status
        document.status = 'processing'
        db.session.commit()

        # Process async to avoid request timeouts / 502 from Render proxy
        app_obj = current_app._get_current_object()
        thread = threading.Thread(
            target=_process_document_in_background,
            args=(app_obj, document.id, file_path, file.content_type),
            daemon=True
        )
        thread.start()

        # Return immediately; frontend can poll GET /documents for status updates
        return jsonify(document.to_dict()), 202
        
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
