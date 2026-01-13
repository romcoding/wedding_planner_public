# RAG Document Upload Feature - Complete Guide

## ✅ Feature Status: FULLY IMPLEMENTED

The RAG (Retrieval-Augmented Generation) document upload feature is **already fully implemented** and ready to use!

## How It Works

### 1. **Upload Documents**
- Go to any venue in the admin dashboard
- Click on the **"Documents"** tab
- Drag and drop PDF or DOCX files, or click to browse
- Files are automatically uploaded and processed

### 2. **Automatic Processing**
When you upload a document, the system automatically:
1. **Parses** the document (extracts text from PDF/DOCX)
2. **Chunks** the text into smaller pieces (1000 chars with 200 char overlap)
3. **Generates embeddings** using OpenAI's embedding API
4. **Stores** chunks and embeddings in the database
5. **Marks** document as "processed" and ready for chat

### 3. **Chat with Documents**
- Go to the **"Chat"** tab in the venue detail modal
- Ask questions about the venue
- The AI searches through uploaded documents using semantic search
- Answers include citations linking back to source documents

## Technical Architecture

### Backend Components

1. **Document Upload** (`venue_documents.py`)
   - Endpoint: `POST /api/venues/{id}/documents`
   - Handles file upload, validation, and storage
   - Processes documents synchronously

2. **Document Parser** (`document_parser.py`)
   - Parses PDF files using `pdfminer.six`
   - Parses DOCX files using `python-docx`
   - Chunks text intelligently (sentence boundaries)

3. **Embedding Service** (`embedding_service.py`)
   - Uses OpenAI's `text-embedding-3-small` model
   - Generates vector embeddings for text chunks
   - Supports batch processing

4. **Chat Service** (`venue_chat_service.py`)
   - Retrieves relevant chunks using cosine similarity
   - Builds context from top-k similar chunks
   - Generates responses with citations

### Database Schema

- **venue_documents**: Stores document metadata
- **document_chunks**: Stores text chunks with embeddings (JSON format)
- **venue_chat_history**: Stores chat conversations

### Frontend Components

- **VenueDocumentsTab**: Drag-and-drop upload interface
- **VenueChatTab**: Chat interface with citations
- Both integrated into `VenueDetailModal`

## Requirements

### Backend Dependencies (Already in requirements.txt)
- `pdfminer.six==20221105` - PDF parsing
- `python-docx==1.1.0` - DOCX parsing
- `openai>=1.40.0` - Embeddings and chat
- `numpy==1.24.3` - Vector similarity calculations

### Environment Variables
- `OPENAI_API_KEY` - Required for embeddings and chat

### Storage
- Files are stored in `wedding-planner-backend/uploads/documents/`
- Works on both Render (ephemeral) and local filesystem
- For production, consider using S3 or similar cloud storage

## Usage Instructions

### Step 1: Access Documents Tab
1. Navigate to **Venues** in the admin dashboard
2. Click on any venue to open the detail modal
3. Click on the **"Documents"** tab

### Step 2: Upload PDF/DOCX
1. Drag and drop files into the upload area, OR
2. Click "Select PDF or DOCX Files" button
3. Select one or more files (PDF or DOCX format)
4. Wait for upload and processing (status shown in real-time)

### Step 3: Verify Processing
- Check document status:
  - **Processing**: Document is being parsed and embedded
  - **Processed**: Ready for chat (shows chunk count)
  - **Error**: Processing failed (check error message)

### Step 4: Chat with Documents
1. Go to the **"Chat"** tab
2. Ask questions like:
   - "What is the capacity of this venue?"
   - "What are the catering options?"
   - "What is included in the rental price?"
3. Answers will include citations to source documents

## Current Limitations & Future Improvements

### Current Implementation
- ✅ PDF and DOCX support
- ✅ Automatic chunking and embedding
- ✅ Semantic search with cosine similarity
- ✅ Chat with citations
- ✅ Document status tracking

### Potential Improvements
1. **Async Processing**: Process documents in background (Celery/Redis)
2. **Cloud Storage**: Use S3/CloudFront for file storage
3. **pgvector**: Use PostgreSQL vector extension for better performance
4. **Document Preview**: Show PDF preview in UI
5. **Batch Upload**: Upload multiple files at once
6. **Document Categories**: Organize documents by type
7. **Search**: Full-text search across documents
8. **Export**: Download processed documents

## Troubleshooting

### Documents Not Processing
- Check Render logs for errors
- Verify `OPENAI_API_KEY` is set correctly
- Ensure `pdfminer.six` and `python-docx` are installed
- Check file size (max 10MB recommended)

### Chat Not Finding Documents
- Verify documents are in "processed" status
- Check that chunks have embeddings (chunk_count > 0)
- Ensure OpenAI API key has sufficient quota

### Upload Fails
- Check file format (PDF or DOCX only)
- Verify file size (max 10MB)
- Check Render logs for specific errors
- Ensure user has admin role

## API Endpoints

### Upload Document
```
POST /api/venues/{venue_id}/documents
Content-Type: multipart/form-data
Body: file (PDF or DOCX)
```

### Get Documents
```
GET /api/venues/{venue_id}/documents
```

### Chat with Documents
```
POST /api/venues/{venue_id}/chat
Body: {
  "message": "What is the capacity?",
  "session_id": "optional-session-id"
}
```

### Get Chat History
```
GET /api/venues/{venue_id}/chat/history?session_id={session_id}
```

## Deployment Notes

### Render
- Files are stored in ephemeral filesystem
- Consider using Render Disk for persistent storage
- Or integrate S3 for production

### Vercel
- Frontend only, no file storage needed
- All file operations happen on backend (Render)

## Summary

**The RAG document upload feature is fully functional!** Just:
1. Go to Venues → Select a venue → Documents tab
2. Upload your PDF/DOCX files
3. Wait for processing (automatic)
4. Use the Chat tab to ask questions

Everything is already set up and working! 🎉
