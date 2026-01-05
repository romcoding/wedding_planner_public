#!/usr/bin/env python3
"""
Inline migration script - can be run directly in Render shell
Run: python -c "$(cat migrate_multilingual_inline.py)"
Or copy-paste the code below into Python shell
"""

import os
import sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from dotenv import load_dotenv
load_dotenv()

from src.main import create_app
from src.models import db
from sqlalchemy import inspect, text

app = create_app()
with app.app_context():
    print("=" * 50)
    print("Database Migration: Adding multilingual content support")
    print("=" * 50)
    print()

    try:
        inspector = inspect(db.engine)
        
        # Check if content table exists
        if not inspector.has_table('content'):
            print("⚠️  Content table does not exist. Please create it first.")
            sys.exit(1)
        
        columns = [col['name'] for col in inspector.get_columns('content')]
        print(f"Current columns: {', '.join(columns)}")
        print()

        # Add content_en, content_de, content_fr columns if they don't exist
        for lang in ['en', 'de', 'fr']:
            col_name = f'content_{lang}'
            if col_name not in columns:
                print(f"Adding '{col_name}' column to 'content' table...")
                with db.engine.connect() as conn:
                    conn.execute(text(f"ALTER TABLE content ADD COLUMN {col_name} TEXT"))
                    conn.commit()
                print(f"✅ Added '{col_name}' column.")
            else:
                print(f"✓ '{col_name}' column already exists.")

        # Migrate existing content to content_en
        if 'content_en' in columns or 'content_en' in [col['name'] for col in inspector.get_columns('content')]:
            print("\nMigrating existing content to content_en...")
            with db.engine.connect() as conn:
                result = conn.execute(text("""
                    UPDATE content 
                    SET content_en = content 
                    WHERE (content_en IS NULL OR content_en = '') AND content IS NOT NULL
                """))
                conn.commit()
                print(f"✅ Migrated {result.rowcount} content items to content_en.")

        print()
        print("=" * 50)
        print("✅ Migration completed successfully!")
        print("=" * 50)
        print()

    except Exception as e:
        db.session.rollback()
        print(f"✗ Error during migration: {e}")
        import traceback
        traceback.print_exc()
        raise

