#!/usr/bin/env python3
"""
Migration script to add venue offers, documents, and chat tables
Run with: python3 migrate_add_venue_offers_documents_chat.py
"""
import sys
import os

# Add parent directory to path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from src.main import app
from src.models import db
from sqlalchemy import text

def run_migration():
    with app.app_context():
        try:
            # Check if tables exist
            inspector = db.inspect(db.engine)
            existing_tables = inspector.get_table_names()
            
            # Create venue_offer_categories table
            if 'venue_offer_categories' not in existing_tables:
                print("Creating venue_offer_categories table...")
                db.session.execute(text("""
                    CREATE TABLE venue_offer_categories (
                        id SERIAL PRIMARY KEY,
                        venue_id INTEGER NOT NULL REFERENCES venues(id) ON DELETE CASCADE,
                        name VARCHAR(200) NOT NULL,
                        description TEXT,
                        "order" INTEGER DEFAULT 0,
                        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                    )
                """))
                db.session.commit()
                print("✓ Created venue_offer_categories table")
            else:
                print("✓ venue_offer_categories table already exists")
            
            # Create venue_offers table
            if 'venue_offers' not in existing_tables:
                print("Creating venue_offers table...")
                db.session.execute(text("""
                    CREATE TABLE venue_offers (
                        id SERIAL PRIMARY KEY,
                        category_id INTEGER NOT NULL REFERENCES venue_offer_categories(id) ON DELETE CASCADE,
                        venue_id INTEGER NOT NULL REFERENCES venues(id) ON DELETE CASCADE,
                        name VARCHAR(200) NOT NULL,
                        description TEXT,
                        price NUMERIC(10, 2),
                        price_type VARCHAR(20) DEFAULT 'fixed',
                        currency VARCHAR(10) DEFAULT 'EUR',
                        unit VARCHAR(50),
                        "order" INTEGER DEFAULT 0,
                        min_quantity INTEGER,
                        max_quantity INTEGER,
                        is_available BOOLEAN DEFAULT TRUE,
                        notes TEXT,
                        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                    )
                """))
                db.session.commit()
                print("✓ Created venue_offers table")
            else:
                print("✓ venue_offers table already exists")
            
            # Create venue_documents table
            if 'venue_documents' not in existing_tables:
                print("Creating venue_documents table...")
                db.session.execute(text("""
                    CREATE TABLE venue_documents (
                        id SERIAL PRIMARY KEY,
                        venue_id INTEGER NOT NULL REFERENCES venues(id) ON DELETE CASCADE,
                        user_id INTEGER NOT NULL REFERENCES users(id),
                        filename VARCHAR(500) NOT NULL,
                        original_filename VARCHAR(500) NOT NULL,
                        file_path VARCHAR(1000) NOT NULL,
                        file_size INTEGER,
                        mime_type VARCHAR(100),
                        status VARCHAR(20) DEFAULT 'uploaded',
                        error_message TEXT,
                        extracted_text TEXT,
                        chunk_count INTEGER DEFAULT 0,
                        uploaded_by VARCHAR(200),
                        notes TEXT,
                        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                    )
                """))
                db.session.commit()
                print("✓ Created venue_documents table")
            else:
                print("✓ venue_documents table already exists")
            
            # Create document_chunks table
            if 'document_chunks' not in existing_tables:
                print("Creating document_chunks table...")
                db.session.execute(text("""
                    CREATE TABLE document_chunks (
                        id SERIAL PRIMARY KEY,
                        document_id INTEGER NOT NULL REFERENCES venue_documents(id) ON DELETE CASCADE,
                        chunk_index INTEGER NOT NULL,
                        text TEXT NOT NULL,
                        text_length INTEGER,
                        embedding TEXT,
                        page_number INTEGER,
                        section_title VARCHAR(500),
                        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                    )
                """))
                db.session.commit()
                print("✓ Created document_chunks table")
            else:
                print("✓ document_chunks table already exists")
            
            # Create venue_chat_history table
            if 'venue_chat_history' not in existing_tables:
                print("Creating venue_chat_history table...")
                db.session.execute(text("""
                    CREATE TABLE venue_chat_history (
                        id SERIAL PRIMARY KEY,
                        venue_id INTEGER NOT NULL REFERENCES venues(id) ON DELETE CASCADE,
                        user_id INTEGER NOT NULL REFERENCES users(id),
                        session_id VARCHAR(100),
                        message_type VARCHAR(20) NOT NULL,
                        message TEXT NOT NULL,
                        citations TEXT,
                        tokens_used INTEGER,
                        model_used VARCHAR(50),
                        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                    )
                """))
                db.session.commit()
                print("✓ Created venue_chat_history table")
            else:
                print("✓ venue_chat_history table already exists")
            
            # Create indexes for better query performance
            print("Creating indexes...")
            try:
                db.session.execute(text("CREATE INDEX IF NOT EXISTS idx_venue_offers_venue_id ON venue_offers(venue_id)"))
                db.session.execute(text("CREATE INDEX IF NOT EXISTS idx_venue_offers_category_id ON venue_offers(category_id)"))
                db.session.execute(text("CREATE INDEX IF NOT EXISTS idx_venue_documents_venue_id ON venue_documents(venue_id)"))
                db.session.execute(text("CREATE INDEX IF NOT EXISTS idx_document_chunks_document_id ON document_chunks(document_id)"))
                db.session.execute(text("CREATE INDEX IF NOT EXISTS idx_venue_chat_venue_id ON venue_chat_history(venue_id)"))
                db.session.execute(text("CREATE INDEX IF NOT EXISTS idx_venue_chat_session_id ON venue_chat_history(session_id)"))
                db.session.commit()
                print("✓ Created indexes")
            except Exception as e:
                print(f"Note: Some indexes may already exist: {e}")
            
            print("\n✅ Migration completed successfully!")
            
        except Exception as e:
            db.session.rollback()
            print(f"\n❌ Migration failed: {e}")
            import traceback
            traceback.print_exc()
            sys.exit(1)

if __name__ == '__main__':
    run_migration()
