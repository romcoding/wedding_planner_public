"""
Document parsing service for PDF and DOCX files
"""
import os
import logging
from typing import Optional, List, Tuple
import os as _os

logger = logging.getLogger(__name__)

# Try to import required libraries
try:
    from pdfminer.high_level import extract_text as pdf_extract_text
    PDF_AVAILABLE = True
except ImportError:
    PDF_AVAILABLE = False
    logger.warning("pdfminer.six not available. PDF parsing will be disabled.")

try:
    from docx import Document as DocxDocument
    DOCX_AVAILABLE = True
except ImportError:
    DOCX_AVAILABLE = False
    logger.warning("python-docx not available. DOCX parsing will be disabled.")


def parse_pdf(file_path: str) -> Optional[str]:
    """Extract text from PDF file"""
    if not PDF_AVAILABLE:
        raise ImportError("pdfminer.six is not installed. Install with: pip install pdfminer.six")
    
    try:
        # Hard limits to avoid OOM on small Render instances.
        # pdfminer can be memory-hungry depending on PDF structure (fonts/images/layout).
        try:
            max_pages = int(_os.getenv('MAX_PDF_PAGES', '25'))
        except ValueError:
            max_pages = 25
        caching = _os.getenv('PDFMINER_CACHING', 'false').lower() in ('1', 'true', 'yes')

        # maxpages=0 means "all pages" — we never want that on low-memory instances.
        maxpages = max_pages if max_pages > 0 else 25

        text = pdf_extract_text(
            file_path,
            maxpages=maxpages,
            caching=caching,
        )
        return text.strip() if text else None
    except MemoryError:
        logger.error(f"MemoryError parsing PDF {file_path} (likely too complex/large for current instance)")
        raise
    except Exception as e:
        logger.error(f"Error parsing PDF {file_path}: {e}")
        raise


def parse_docx(file_path: str) -> Optional[str]:
    """Extract text from DOCX file"""
    if not DOCX_AVAILABLE:
        raise ImportError("python-docx is not installed. Install with: pip install python-docx")
    
    try:
        doc = DocxDocument(file_path)
        paragraphs = []
        for para in doc.paragraphs:
            if para.text.strip():
                paragraphs.append(para.text)
        return '\n\n'.join(paragraphs) if paragraphs else None
    except Exception as e:
        logger.error(f"Error parsing DOCX {file_path}: {e}")
        raise


def parse_document(file_path: str, mime_type: str) -> Optional[str]:
    """Parse document based on MIME type"""
    if not os.path.exists(file_path):
        raise FileNotFoundError(f"File not found: {file_path}")
    
    mime_type_lower = mime_type.lower() if mime_type else ''
    
    if 'pdf' in mime_type_lower or file_path.lower().endswith('.pdf'):
        return parse_pdf(file_path)
    elif 'wordprocessingml' in mime_type_lower or 'msword' in mime_type_lower or file_path.lower().endswith(('.docx', '.doc')):
        return parse_docx(file_path)
    else:
        raise ValueError(f"Unsupported file type: {mime_type}")


def chunk_text(text: str, chunk_size: int = 1000, overlap: int = 200) -> List[Tuple[int, str]]:
    """
    Split text into chunks with overlap for better context preservation.
    Returns list of (chunk_index, chunk_text) tuples.
    """
    if not text:
        return []
    
    chunks = []
    start = 0
    chunk_index = 0
    
    while start < len(text):
        end = start + chunk_size
        
        # Try to break at sentence boundary
        if end < len(text):
            # Look for sentence endings
            for punct in ['. ', '.\n', '! ', '!\n', '? ', '?\n']:
                last_punct = text.rfind(punct, start, end)
                if last_punct != -1:
                    end = last_punct + len(punct)
                    break
        
        chunk = text[start:end].strip()
        if chunk:
            chunks.append((chunk_index, chunk))
            chunk_index += 1
        
        # Move start forward with overlap
        start = end - overlap if end < len(text) else end
    
    return chunks
