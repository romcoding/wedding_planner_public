"""
Database migration script to add seating chart tables
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
        print("=" * 60)
        print("Database Migration: Adding Seating Chart Tables")
        print("=" * 60)
        print()

        try:
            inspector = inspect(db.engine)
            
            # Create tables table
            if not inspector.has_table('tables'):
                print("Creating 'tables' table...")
                try:
                    with db.engine.connect() as conn:
                        conn.execute(text("""
                            CREATE TABLE tables (
                                id INTEGER PRIMARY KEY,
                                user_id INTEGER NOT NULL,
                                name VARCHAR(100) NOT NULL,
                                capacity INTEGER NOT NULL,
                                shape VARCHAR(20) DEFAULT 'round',
                                position_x FLOAT DEFAULT 0.0,
                                position_y FLOAT DEFAULT 0.0,
                                notes TEXT,
                                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                                FOREIGN KEY (user_id) REFERENCES users(id)
                            )
                        """))
                        conn.commit()
                    print("✅ Created 'tables' table.")
                except Exception as e:
                    print(f"❌ Error creating tables table: {e}")
                    db.session.rollback()
            else:
                print("✓ 'tables' table already exists.")
            
            # Create seat_assignments table
            if not inspector.has_table('seat_assignments'):
                print("Creating 'seat_assignments' table...")
                try:
                    with db.engine.connect() as conn:
                        conn.execute(text("""
                            CREATE TABLE seat_assignments (
                                id INTEGER PRIMARY KEY,
                                table_id INTEGER NOT NULL,
                                guest_id INTEGER,
                                seat_number INTEGER NOT NULL,
                                notes TEXT,
                                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                                FOREIGN KEY (table_id) REFERENCES tables(id) ON DELETE CASCADE,
                                FOREIGN KEY (guest_id) REFERENCES guests(id),
                                UNIQUE(table_id, seat_number)
                            )
                        """))
                        conn.commit()
                    print("✅ Created 'seat_assignments' table.")
                except Exception as e:
                    print(f"❌ Error creating seat_assignments table: {e}")
                    db.session.rollback()
            else:
                print("✓ 'seat_assignments' table already exists.")

            print()
            print("=" * 60)
            print("✅ Migration completed successfully!")
            print("=" * 60)

        except Exception as e:
            print(f"❌ Migration failed: {e}")
            import traceback
            traceback.print_exc()
            db.session.rollback()
            raise

if __name__ == '__main__':
    migrate()
