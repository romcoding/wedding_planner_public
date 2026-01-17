"""
Migration script to create moodboards table
Run this script in Render Shell: python3 migrate_create_moodboards_table.py
"""
import os
import sys
from dotenv import load_dotenv

# Add the backend directory to the path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

load_dotenv()

from src.main import create_app
from src.models import db, Moodboard


def migrate():
    app = create_app()
    with app.app_context():
        try:
            Moodboard.__table__.create(db.engine, checkfirst=True)
            print("✓ Successfully created 'moodboards' table")
        except Exception as e:
            print(f"✗ Error: {e}")
            if "already exists" in str(e).lower() or "duplicate" in str(e).lower():
                print("  (Table may already exist, which is fine)")
            else:
                raise


if __name__ == "__main__":
    migrate()

