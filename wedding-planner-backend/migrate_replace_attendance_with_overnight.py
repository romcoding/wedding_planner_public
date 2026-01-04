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
        print("Database Migration: Replacing attendance_type with overnight_stay")
        print("=" * 50)
        print()

        try:
            inspector = inspect(db.engine)
            columns = [col['name'] for col in inspector.get_columns('guests')]

            # Remove attendance_type column if it exists
            if 'attendance_type' in columns:
                print("Removing 'attendance_type' column from 'guests' table...")
                with db.engine.connect() as conn:
                    conn.execute(text("ALTER TABLE guests DROP COLUMN IF EXISTS attendance_type"))
                    conn.commit()
                print("✅ Removed 'attendance_type' column.")

            # Add overnight_stay column if it doesn't exist
            if 'overnight_stay' not in columns:
                print("Adding 'overnight_stay' column to 'guests' table...")
                with db.engine.connect() as conn:
                    conn.execute(text("ALTER TABLE guests ADD COLUMN overnight_stay BOOLEAN DEFAULT FALSE"))
                    conn.commit()
                print("✅ Added 'overnight_stay' column with default value FALSE.")
            else:
                print("✓ 'overnight_stay' column already exists.")

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

