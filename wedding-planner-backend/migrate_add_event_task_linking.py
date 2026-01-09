"""
Database migration script to add event_id to tasks and end_date to events
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
        print("Database Migration: Adding Event-Task Linking")
        print("=" * 60)
        print()

        try:
            inspector = inspect(db.engine)
            
            # Add event_id to tasks table
            if inspector.has_table('tasks'):
                columns = [col['name'] for col in inspector.get_columns('tasks')]
                if 'event_id' not in columns:
                    print("Adding 'event_id' column to 'tasks' table...")
                    try:
                        with db.engine.connect() as conn:
                            conn.execute(text("ALTER TABLE tasks ADD COLUMN event_id INTEGER REFERENCES events(id)"))
                            conn.commit()
                        print("✅ Added 'event_id' column to tasks table.")
                    except Exception as e:
                        print(f"❌ Error adding event_id: {e}")
                        db.session.rollback()
                else:
                    print("✓ 'event_id' column already exists in tasks table.")
                
                if 'reminder_date' not in columns:
                    print("Adding 'reminder_date' column to 'tasks' table...")
                    try:
                        with db.engine.connect() as conn:
                            conn.execute(text("ALTER TABLE tasks ADD COLUMN reminder_date TIMESTAMP"))
                            conn.commit()
                        print("✅ Added 'reminder_date' column to tasks table.")
                    except Exception as e:
                        print(f"❌ Error adding reminder_date: {e}")
                        db.session.rollback()
                else:
                    print("✓ 'reminder_date' column already exists in tasks table.")
            
            # Add end_date to events table
            if inspector.has_table('events'):
                columns = [col['name'] for col in inspector.get_columns('events')]
                if 'end_date' not in columns:
                    print("Adding 'end_date' column to 'events' table...")
                    try:
                        with db.engine.connect() as conn:
                            conn.execute(text("ALTER TABLE events ADD COLUMN end_date DATE"))
                            conn.commit()
                        print("✅ Added 'end_date' column to events table.")
                    except Exception as e:
                        print(f"❌ Error adding end_date: {e}")
                        db.session.rollback()
                else:
                    print("✓ 'end_date' column already exists in events table.")

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
