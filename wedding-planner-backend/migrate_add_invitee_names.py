#!/usr/bin/env python3
"""
Migration script to add invitee_names + attending_names columns to guests table.
Run this in Render Shell: python migrate_add_invitee_names.py
"""

import json
from sqlalchemy import inspect, text
from src.main import create_app
from src.models import db, Guest


def migrate():
    app = create_app()
    with app.app_context():
        print("=" * 60)
        print("Adding invitee_names + attending_names columns to guests table")
        print("=" * 60)
        print()

        inspector = inspect(db.engine)
        columns = [col["name"] for col in inspector.get_columns("guests")]

        added_any = False

        if "invitee_names" not in columns:
            print("Adding 'invitee_names' column...")
            db.session.execute(text("ALTER TABLE guests ADD COLUMN invitee_names TEXT"))
            db.session.commit()
            print("✅ Added 'invitee_names'")
            added_any = True
        else:
            print("✅ 'invitee_names' already exists")

        if "attending_names" not in columns:
            print("Adding 'attending_names' column...")
            db.session.execute(text("ALTER TABLE guests ADD COLUMN attending_names TEXT"))
            db.session.commit()
            print("✅ Added 'attending_names'")
            added_any = True
        else:
            print("✅ 'attending_names' already exists")

        # Backfill invitee_names for existing guests where empty
        print("\nBackfilling invitee_names for existing guests (if missing)...")
        guests = Guest.query.all()
        updated = 0
        for g in guests:
            if not g.invitee_names:
                full = f"{g.first_name} {g.last_name}".strip()
                if full:
                    g.invitee_names = json.dumps([full])
                    updated += 1
        if updated:
            db.session.commit()
            print(f"✅ Backfilled invitee_names for {updated} guests")
        else:
            print("✅ No backfill needed")

        print()
        print("=" * 60)
        print("Migration complete!")
        print("=" * 60)


if __name__ == "__main__":
    migrate()

