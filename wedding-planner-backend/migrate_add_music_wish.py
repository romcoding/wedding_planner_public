"""
Migration script to add music_wish column to guests table
Run this script in Render Shell: python migrate_add_music_wish.py
"""
import os
import sys
from dotenv import load_dotenv

# Add the backend directory to the path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

load_dotenv()

from src.main import create_app
from src.models import db

def migrate():
    app = create_app()
    with app.app_context():
        try:
            # Check if column already exists
            from sqlalchemy import inspect, text
            inspector = inspect(db.engine)
            columns = [col['name'] for col in inspector.get_columns('guests')]
            
            if 'music_wish' in columns:
                print("✓ Column 'music_wish' already exists in 'guests' table")
                return
            
            # Add music_wish column
            with db.engine.connect() as conn:
                conn.execute(text("ALTER TABLE guests ADD COLUMN music_wish TEXT"))
                conn.commit()
            print("✓ Successfully added 'music_wish' column to 'guests' table")
        except Exception as e:
            db.session.rollback()
            print(f"✗ Error: {e}")
            raise

if __name__ == '__main__':
    migrate()

