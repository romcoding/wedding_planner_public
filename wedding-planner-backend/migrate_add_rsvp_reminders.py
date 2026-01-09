"""
Database migration script to add RSVP reminder tables
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
        print("Database Migration: Adding RSVP Reminder Tables")
        print("=" * 60)
        print()

        try:
            inspector = inspect(db.engine)
            
            # Create rsvp_reminders table
            if not inspector.has_table('rsvp_reminders'):
                print("Creating 'rsvp_reminders' table...")
                try:
                    with db.engine.connect() as conn:
                        conn.execute(text("""
                            CREATE TABLE rsvp_reminders (
                                id INTEGER PRIMARY KEY,
                                user_id INTEGER NOT NULL,
                                name VARCHAR(200) NOT NULL,
                                days_before_event INTEGER NOT NULL,
                                subject VARCHAR(500) NOT NULL,
                                message TEXT NOT NULL,
                                target_status VARCHAR(20) DEFAULT 'pending',
                                only_unassigned BOOLEAN DEFAULT FALSE,
                                is_active BOOLEAN DEFAULT TRUE,
                                last_sent_at TIMESTAMP,
                                next_send_at TIMESTAMP,
                                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                                FOREIGN KEY (user_id) REFERENCES users(id)
                            )
                        """))
                        conn.commit()
                    print("✅ Created 'rsvp_reminders' table.")
                except Exception as e:
                    print(f"❌ Error creating rsvp_reminders table: {e}")
                    db.session.rollback()
            else:
                print("✓ 'rsvp_reminders' table already exists.")
            
            # Create reminder_sent table
            if not inspector.has_table('reminder_sent'):
                print("Creating 'reminder_sent' table...")
                try:
                    with db.engine.connect() as conn:
                        conn.execute(text("""
                            CREATE TABLE reminder_sent (
                                id INTEGER PRIMARY KEY,
                                reminder_id INTEGER NOT NULL,
                                guest_id INTEGER NOT NULL,
                                sent_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                                FOREIGN KEY (reminder_id) REFERENCES rsvp_reminders(id) ON DELETE CASCADE,
                                FOREIGN KEY (guest_id) REFERENCES guests(id),
                                UNIQUE(reminder_id, guest_id)
                            )
                        """))
                        conn.commit()
                    print("✅ Created 'reminder_sent' table.")
                except Exception as e:
                    print(f"❌ Error creating reminder_sent table: {e}")
                    db.session.rollback()
            else:
                print("✓ 'reminder_sent' table already exists.")

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
