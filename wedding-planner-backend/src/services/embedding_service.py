"""
Embedding service using OpenAI API for document chunks
"""
import os
import json
import logging
from typing import List, Optional

logger = logging.getLogger(__name__)

# Try to import OpenAI
try:
    import openai
    OPENAI_AVAILABLE = True
except ImportError:
    OPENAI_AVAILABLE = False
    logger.warning("OpenAI library not available. Install with: pip install openai")


def get_embedding(text: str, model: str = "text-embedding-3-small") -> Optional[List[float]]:
    """
    Get embedding vector for text using OpenAI API
    Returns list of floats or None if error
    """
    if not OPENAI_AVAILABLE:
        logger.error("OpenAI library not available")
        return None
    
    api_key = os.getenv('OPENAI_API_KEY')
    if not api_key:
        logger.error("OPENAI_API_KEY environment variable not set")
        return None
    
    try:
        client = openai.OpenAI(api_key=api_key)
        response = client.embeddings.create(
            model=model,
            input=text
        )
        return response.data[0].embedding
    except Exception as e:
        logger.error(f"Error getting embedding: {e}")
        return None


def get_embeddings_batch(texts: List[str], model: str = "text-embedding-3-small") -> List[Optional[List[float]]]:
    """
    Get embeddings for multiple texts in batch
    Returns list of embeddings (or None for failed ones)
    """
    if not OPENAI_AVAILABLE:
        logger.error("OpenAI library not available")
        return [None] * len(texts)
    
    api_key = os.getenv('OPENAI_API_KEY')
    if not api_key:
        logger.error("OPENAI_API_KEY environment variable not set")
        return [None] * len(texts)
    
    try:
        client = openai.OpenAI(api_key=api_key)
        response = client.embeddings.create(
            model=model,
            input=texts
        )
        return [item.embedding for item in response.data]
    except Exception as e:
        logger.error(f"Error getting batch embeddings: {e}")
        return [None] * len(texts)


def cosine_similarity(vec1: List[float], vec2: List[float]) -> float:
    """Calculate cosine similarity between two vectors"""
    try:
        import numpy as np
    except ImportError:
        # Fallback to manual calculation
        dot_product = sum(a * b for a, b in zip(vec1, vec2))
        magnitude1 = sum(a * a for a in vec1) ** 0.5
        magnitude2 = sum(b * b for b in vec2) ** 0.5
        if magnitude1 == 0 or magnitude2 == 0:
            return 0.0
        return dot_product / (magnitude1 * magnitude2)
    
    vec1_np = np.array(vec1)
    vec2_np = np.array(vec2)
    dot_product = np.dot(vec1_np, vec2_np)
    magnitude1 = np.linalg.norm(vec1_np)
    magnitude2 = np.linalg.norm(vec2_np)
    if magnitude1 == 0 or magnitude2 == 0:
        return 0.0
    return float(dot_product / (magnitude1 * magnitude2))


def find_similar_chunks(query_embedding: List[float], chunk_embeddings: List[dict], top_k: int = 5) -> List[dict]:
    """
    Find most similar chunks to query embedding
    chunk_embeddings should be list of dicts with 'embedding' (JSON string or list) and other metadata
    Returns top_k most similar chunks with similarity scores
    """
    if not query_embedding:
        return []
    
    similarities = []
    for chunk in chunk_embeddings:
        embedding = chunk.get('embedding')
        if not embedding:
            continue
        
        # Parse embedding if it's a JSON string
        if isinstance(embedding, str):
            try:
                embedding = json.loads(embedding)
            except:
                continue
        
        if not isinstance(embedding, list):
            continue
        
        similarity = cosine_similarity(query_embedding, embedding)
        similarities.append({
            **chunk,
            'similarity': similarity
        })
    
    # Sort by similarity descending
    similarities.sort(key=lambda x: x['similarity'], reverse=True)
    return similarities[:top_k]
