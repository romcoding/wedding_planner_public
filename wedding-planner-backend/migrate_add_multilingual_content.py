import os
import sys
from dotenv import load_dotenv

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
load_dotenv()

from src.main import create_app
from src.models import db
from sqlalchemy import inspect, text

def migrate():
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
                return
            
            columns = [col['name'] for col in inspector.get_columns('content')]

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
            if 'content_en' in columns and 'content' in columns:
                print("\nMigrating existing content to content_en...")
                with db.engine.connect() as conn:
                    result = conn.execute(text("""
                        UPDATE content 
                        SET content_en = content 
                        WHERE content_en IS NULL OR content_en = ''
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
            raise

if __name__ == '__main__':
    migrate()

