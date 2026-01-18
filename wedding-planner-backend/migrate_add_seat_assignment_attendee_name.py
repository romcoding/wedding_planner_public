"""
Migration: add attendee_name column to seat_assignments table.
Run in Render Shell: python3 migrate_add_seat_assignment_attendee_name.py
"""
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
        inspector = inspect(db.engine)
        columns = [col['name'] for col in inspector.get_columns('seat_assignments')]

        if 'attendee_name' not in columns:
            db.session.execute(text("ALTER TABLE seat_assignments ADD COLUMN attendee_name TEXT"))
            print("✅ Added 'attendee_name' column to seat_assignments table.")
        else:
            print("✓ 'attendee_name' column already exists.")

        db.session.commit()


if __name__ == '__main__':
    migrate()

