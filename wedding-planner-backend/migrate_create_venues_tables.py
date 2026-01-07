"""
Database migration script to create venues and venue_requests tables
Run this script in the Render Shell or locally after deployment
"""
import os
import sys
from dotenv import load_dotenv
from sqlalchemy import inspect, text

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
load_dotenv()

from src.main import create_app
from src.models import db

def migrate():
    app = create_app()
    with app.app_context():
        print("=" * 50)
        print("Database Migration: Creating Venues and Venue Requests tables")
        print("=" * 50)
        print()

        try:
            inspector = inspect(db.engine)
            existing_tables = inspector.get_table_names()

            # Create venues table
            if 'venues' not in existing_tables:
                print("Creating 'venues' table...")
                with db.engine.connect() as conn:
                    conn.execute(text("""
                        CREATE TABLE venues (
                            id SERIAL PRIMARY KEY,
                            user_id INTEGER NOT NULL REFERENCES users(id),
                            name VARCHAR(200) NOT NULL,
                            description TEXT,
                            location VARCHAR(200),
                            capacity INTEGER,
                            price_range VARCHAR(50),
                            style VARCHAR(100),
                            amenities TEXT,
                            contact_name VARCHAR(200),
                            contact_email VARCHAR(200),
                            contact_phone VARCHAR(50),
                            website VARCHAR(500),
                            rating FLOAT,
                            notes TEXT,
                            is_deleted BOOLEAN DEFAULT FALSE,
                            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                        )
                    """))
                    conn.commit()
                print("✅ Created 'venues' table.")
            else:
                print("✓ 'venues' table already exists.")

            # Create venue_requests table
            if 'venue_requests' not in existing_tables:
                print("Creating 'venue_requests' table...")
                with db.engine.connect() as conn:
                    conn.execute(text("""
                        CREATE TABLE venue_requests (
                            id SERIAL PRIMARY KEY,
                            venue_id INTEGER NOT NULL REFERENCES venues(id) ON DELETE CASCADE,
                            user_id INTEGER NOT NULL REFERENCES users(id),
                            contact_date DATE NOT NULL,
                            status VARCHAR(50) DEFAULT 'pending',
                            proposed_price NUMERIC(10, 2),
                            notes TEXT,
                            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                        )
                    """))
                    conn.commit()
                print("✅ Created 'venue_requests' table.")
            else:
                print("✓ 'venue_requests' table already exists.")

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

