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
        print("Database Migration: Adding language column to Guests table")
        print("=" * 50)
        print()

        try:
            inspector = inspect(db.engine)
            columns = [col['name'] for col in inspector.get_columns('guests')]

            if 'language' not in columns:
                print("Adding 'language' column to 'guests' table...")
                with db.engine.connect() as conn:
                    conn.execute(text("ALTER TABLE guests ADD COLUMN language VARCHAR(10) DEFAULT 'en'"))
                    conn.commit()
                print("✅ Added 'language' column with default value 'en'.")
            else:
                print("✓ 'language' column already exists.")

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

