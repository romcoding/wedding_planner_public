#!/usr/bin/env python3
"""
Run all pending database migrations.
This script checks and adds any missing columns/tables.
"""

from src.main import create_app
from src.models import db
from sqlalchemy import text, inspect

def migrate():
    app = create_app()
    
    with app.app_context():
        print("=" * 60)
        print("Running Database Migrations")
        print("=" * 60)
        print()
        
        inspector = inspect(db.engine)
        
        # Check guests table columns
        if inspector.has_table('guests'):
            columns = [col['name'] for col in inspector.get_columns('guests')]
            print(f"Current guests table columns: {', '.join(columns)}")
            print()
            
            # Add music_wish if missing
            if 'music_wish' not in columns:
                print("Adding 'music_wish' column to 'guests' table...")
                try:
                    db.session.execute(text("ALTER TABLE guests ADD COLUMN music_wish TEXT"))
                    db.session.commit()
                    print("✅ Added 'music_wish' column")
                except Exception as e:
                    print(f"❌ Error adding music_wish: {e}")
                    db.session.rollback()
            else:
                print("✅ 'music_wish' column already exists")
            
            # Add username if missing
            if 'username' not in columns:
                print("Adding 'username' column to 'guests' table...")
                try:
                    db.session.execute(text("ALTER TABLE guests ADD COLUMN username VARCHAR(80) UNIQUE"))
                    db.session.commit()
                    print("✅ Added 'username' column")
                except Exception as e:
                    print(f"❌ Error adding username: {e}")
                    db.session.rollback()
            else:
                print("✅ 'username' column already exists")
            
            # Add password_hash if missing
            if 'password_hash' not in columns:
                print("Adding 'password_hash' column to 'guests' table...")
                try:
                    db.session.execute(text("ALTER TABLE guests ADD COLUMN password_hash VARCHAR(255)"))
                    db.session.commit()
                    print("✅ Added 'password_hash' column")
                except Exception as e:
                    print(f"❌ Error adding password_hash: {e}")
                    db.session.rollback()
            else:
                print("✅ 'password_hash' column already exists")
        else:
            print("⚠️  'guests' table does not exist. It should be created automatically.")
        
        print()
        
        # Check and create new tables
        tables_to_check = [
            'invitations',
            'events',
            'messages',
            'gift_registry',
            'guest_photos'
        ]
        
        for table_name in tables_to_check:
            if not inspector.has_table(table_name):
                print(f"⚠️  '{table_name}' table does not exist.")
                print(f"   It will be created automatically on next app start.")
            else:
                print(f"✅ '{table_name}' table exists")
        
        print()
        print("=" * 60)
        print("Migration check complete!")
        print("=" * 60)

if __name__ == '__main__':
    migrate()

