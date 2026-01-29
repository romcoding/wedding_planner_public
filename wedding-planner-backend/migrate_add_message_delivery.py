"""
Database migration script to add delivery tracking and idempotency to messages table.
Run this script in the Render Shell or locally after deployment.
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
        print("Database Migration: Adding Message Delivery Tracking")
        print("=" * 60)
        print()

        try:
            inspector = inspect(db.engine)

            if not inspector.has_table('messages'):
                print("⚠️  Messages table does not exist. Please create it first.")
                return

            columns = [col['name'] for col in inspector.get_columns('messages')]
            print(f"Current columns: {', '.join(columns)}")
            print()

            if 'delivery_status' not in columns:
                print("Adding 'delivery_status' column...")
                try:
                    db.session.execute(text("ALTER TABLE messages ADD COLUMN delivery_status VARCHAR(20) DEFAULT 'received'"))
                    db.session.commit()
                    print("✅ Added 'delivery_status' column.")
                except Exception as e:
                    print(f"❌ Error adding delivery_status: {e}")
                    db.session.rollback()
            else:
                print("✓ 'delivery_status' column already exists.")

            if 'delivery_attempted_at' not in columns:
                print("Adding 'delivery_attempted_at' column...")
                try:
                    db.session.execute(text("ALTER TABLE messages ADD COLUMN delivery_attempted_at DATETIME"))
                    db.session.commit()
                    print("✅ Added 'delivery_attempted_at' column.")
                except Exception as e:
                    print(f"❌ Error adding delivery_attempted_at: {e}")
                    db.session.rollback()
            else:
                print("✓ 'delivery_attempted_at' column already exists.")

            if 'delivery_error' not in columns:
                print("Adding 'delivery_error' column...")
                try:
                    db.session.execute(text("ALTER TABLE messages ADD COLUMN delivery_error TEXT"))
                    db.session.commit()
                    print("✅ Added 'delivery_error' column.")
                except Exception as e:
                    print(f"❌ Error adding delivery_error: {e}")
                    db.session.rollback()
            else:
                print("✓ 'delivery_error' column already exists.")

            if 'idempotency_key' not in columns:
                print("Adding 'idempotency_key' column...")
                try:
                    db.session.execute(text("ALTER TABLE messages ADD COLUMN idempotency_key VARCHAR(64)"))
                    db.session.commit()
                    # Unique index allows multiple NULLs (idempotency_key nullable)
                    db.session.execute(text("CREATE UNIQUE INDEX ix_messages_idempotency_key ON messages(idempotency_key)"))
                    db.session.commit()
                    print("✅ Added 'idempotency_key' column with unique index.")
                except Exception as e:
                    # Index may fail if duplicate keys exist; column is still added
                    db.session.rollback()
                    try:
                        db.session.execute(text("ALTER TABLE messages ADD COLUMN idempotency_key VARCHAR(64)"))
                        db.session.commit()
                        print("✅ Added 'idempotency_key' column (index skipped).")
                    except Exception as e2:
                        print(f"❌ Error adding idempotency_key: {e2}")
                        db.session.rollback()
            else:
                print("✓ 'idempotency_key' column already exists.")

            print()
            print("✅ Migration complete.")

        except Exception as e:
            print(f"❌ Migration failed: {e}")
            raise

if __name__ == '__main__':
    migrate()
