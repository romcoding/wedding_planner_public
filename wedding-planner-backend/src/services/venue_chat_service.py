"""
Chat service for venue Q&A using RAG (Retrieval-Augmented Generation)
"""
import os
import json
import logging
from typing import List, Dict, Optional

logger = logging.getLogger(__name__)

# Try to import OpenAI
try:
    import openai
    OPENAI_AVAILABLE = True
except ImportError:
    OPENAI_AVAILABLE = False
    logger.warning("OpenAI library not available. Install with: pip install openai")

from src.services.embedding_service import get_embedding, find_similar_chunks
from src.models import DocumentChunk, VenueDocument


def retrieve_relevant_chunks(venue_id: int, query: str, top_k: int = 5) -> List[Dict]:
    """
    Retrieve relevant document chunks for a query using semantic search
    Returns list of chunks with metadata for citations
    """
    if not OPENAI_AVAILABLE:
        logger.error("OpenAI library not available")
        return []
    
    # Get query embedding
    query_embedding = get_embedding(query)
    if not query_embedding:
        logger.error("Failed to get query embedding")
        return []
    
    # Get all chunks for this venue's documents
    from src.models import db
    chunks = db.session.query(DocumentChunk).join(VenueDocument).filter(
        VenueDocument.venue_id == venue_id,
        VenueDocument.status == 'processed'
    ).all()
    
    if not chunks:
        return []
    
    # Prepare chunk data with embeddings
    chunk_data = []
    for chunk in chunks:
        embedding = None
        if chunk.embedding:
            try:
                embedding = json.loads(chunk.embedding) if isinstance(chunk.embedding, str) else chunk.embedding
            except:
                pass
        
        if embedding:
            chunk_data.append({
                'id': chunk.id,
                'document_id': chunk.document_id,
                'chunk_index': chunk.chunk_index,
                'text': chunk.text,
                'page_number': chunk.page_number,
                'section_title': chunk.section_title,
                'embedding': embedding,
                'document': {
                    'id': chunk.document.id,
                    'filename': chunk.document.original_filename,
                }
            })
    
    # Find most similar chunks
    similar_chunks = find_similar_chunks(query_embedding, chunk_data, top_k=top_k)
    
    return similar_chunks


def generate_chat_response(
    venue_id: int,
    user_query: str,
    conversation_history: Optional[List[Dict]] = None,
    model: str = "gpt-5-mini"  # Latest GPT-5-mini model (best balance of performance and cost)
) -> Dict:
    """
    Generate chat response using RAG
    Returns dict with 'message', 'citations', 'tokens_used', 'model_used'
    """
    if not OPENAI_AVAILABLE:
        return {
            'message': 'OpenAI API is not configured. Please set OPENAI_API_KEY environment variable.',
            'citations': [],
            'tokens_used': 0,
            'model_used': None
        }
    
    api_key = os.getenv('OPENAI_API_KEY')
    if not api_key:
        return {
            'message': 'OpenAI API key is not configured.',
            'citations': [],
            'tokens_used': 0,
            'model_used': None
        }
    
    try:
        # Retrieve relevant chunks
        relevant_chunks = retrieve_relevant_chunks(venue_id, user_query, top_k=5)
        
        # Build context from chunks
        context_parts = []
        citations = []
        for i, chunk in enumerate(relevant_chunks, 1):
            context_parts.append(f"[Document {i}]: {chunk['text']}")
            citations.append({
                'document_id': chunk['document_id'],
                'chunk_id': chunk['id'],
                'text': chunk['text'][:200] + '...' if len(chunk['text']) > 200 else chunk['text'],
                'page': chunk.get('page_number'),
                'filename': chunk['document']['filename'],
                'index': i
            })
        
        context = '\n\n'.join(context_parts) if context_parts else None
        
        # Build system prompt
        system_prompt = """You are a helpful assistant answering questions about a wedding venue based on uploaded documents.
When you reference information from the documents, cite them using [Document X] notation.
If you don't know the answer based on the provided documents, say so clearly.
Be concise and helpful."""
        
        # Build messages
        messages = [{"role": "system", "content": system_prompt}]
        
        # Add conversation history if provided
        if conversation_history:
            for msg in conversation_history[-6:]:  # Last 6 messages for context
                messages.append({
                    "role": msg.get('message_type', 'user'),
                    "content": msg.get('message', '')
                })
        
        # Add current query with context
        user_message = user_query
        if context:
            user_message = f"""Based on the following documents about this venue, answer the question:

{context}

Question: {user_query}

Please provide a helpful answer and cite relevant documents using [Document X] notation."""
        
        messages.append({"role": "user", "content": user_message})
        
        # Call OpenAI API with fallback to gpt-4o if GPT-5 not available
        client = openai.OpenAI(api_key=api_key)
        
        # Try GPT-5 model first, fallback to gpt-4o if not available
        try:
            response = client.chat.completions.create(
                model=model,
                messages=messages,
                temperature=0.7,
                max_tokens=1000
            )
        except Exception as e:
            # If GPT-5 model not available, fallback to gpt-4o
            if model.startswith('gpt-5'):
                logger.warning(f"GPT-5 model {model} not available, falling back to gpt-4o: {e}")
                model = "gpt-4o"
                response = client.chat.completions.create(
                    model=model,
                    messages=messages,
                    temperature=0.7,
                    max_tokens=1000
                )
            else:
                raise
        
        assistant_message = response.choices[0].message.content
        tokens_used = response.usage.total_tokens if response.usage else 0
        
        return {
            'message': assistant_message,
            'citations': citations,
            'tokens_used': tokens_used,
            'model_used': model
        }
        
    except Exception as e:
        logger.error(f"Error generating chat response: {e}")
        return {
            'message': f'Sorry, I encountered an error: {str(e)}',
            'citations': [],
            'tokens_used': 0,
            'model_used': None
        }
