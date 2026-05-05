from models import db
from datetime import datetime

class VenueDocument(db.Model):
    """Uploaded documents for a venue (PDFs, DOCX files) that can be used for chat context"""
    __tablename__ = 'venue_documents'
    
    id = db.Column(db.Integer, primary_key=True)
    venue_id = db.Column(db.Integer, db.ForeignKey('venues.id', ondelete='CASCADE'), nullable=False)
    user_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)
    
    filename = db.Column(db.String(500), nullable=False)
    original_filename = db.Column(db.String(500), nullable=False)
    file_path = db.Column(db.String(1000), nullable=False)  # Path to stored file
    file_size = db.Column(db.Integer)  # Size in bytes
    mime_type = db.Column(db.String(100))  # e.g., 'application/pdf', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    
    # Processing status
    status = db.Column(db.String(20), default='uploaded')  # 'uploaded', 'processing', 'processed', 'error'
    error_message = db.Column(db.Text)
    
    # Extracted content
    extracted_text = db.Column(db.Text)  # Full extracted text
    chunk_count = db.Column(db.Integer, default=0)  # Number of text chunks created
    
    # Metadata
    uploaded_by = db.Column(db.String(200))  # User name who uploaded
    notes = db.Column(db.Text)
    
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    venue = db.relationship('Venue', backref=db.backref('documents', lazy=True, cascade='all, delete-orphan'))
    user = db.relationship('User', backref=db.backref('uploaded_documents', lazy=True))
    chunks = db.relationship('DocumentChunk', backref='document', lazy=True, cascade='all, delete-orphan')
    
    def to_dict(self, include_chunks=False):
        result = {
            'id': self.id,
            'venue_id': self.venue_id,
            'user_id': self.user_id,
            'filename': self.filename,
            'original_filename': self.original_filename,
            'file_path': self.file_path,
            'file_size': self.file_size,
            'mime_type': self.mime_type,
            'status': self.status,
            'error_message': self.error_message,
            'chunk_count': self.chunk_count,
            'uploaded_by': self.uploaded_by,
            'notes': self.notes,
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'updated_at': self.updated_at.isoformat() if self.updated_at else None,
        }
        if include_chunks:
            result['chunks'] = [chunk.to_dict() for chunk in self.chunks]
        return result


class DocumentChunk(db.Model):
    """Text chunks from documents with embeddings for vector search"""
    __tablename__ = 'document_chunks'
    
    id = db.Column(db.Integer, primary_key=True)
    document_id = db.Column(db.Integer, db.ForeignKey('venue_documents.id', ondelete='CASCADE'), nullable=False)
    
    chunk_index = db.Column(db.Integer, nullable=False)  # Order of chunk in document
    text = db.Column(db.Text, nullable=False)  # Chunk text content
    text_length = db.Column(db.Integer)  # Character count
    
    # Embedding vector (stored as JSON array or using pgvector if available)
    embedding = db.Column(db.Text)  # JSON array of floats, or use pgvector Vector type if available
    
    # Metadata for citations
    page_number = db.Column(db.Integer)  # Page number in original document
    section_title = db.Column(db.String(500))  # Optional section title
    
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    
    def to_dict(self):
        embedding_list = None
        if self.embedding:
            try:
                import json
                embedding_list = json.loads(self.embedding)
            except:
                pass
        
        return {
            'id': self.id,
            'document_id': self.document_id,
            'chunk_index': self.chunk_index,
            'text': self.text,
            'text_length': self.text_length,
            'embedding': embedding_list,
            'page_number': self.page_number,
            'section_title': self.section_title,
            'created_at': self.created_at.isoformat() if self.created_at else None,
        }
