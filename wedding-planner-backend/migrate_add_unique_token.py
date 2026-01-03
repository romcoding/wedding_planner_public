#!/usr/bin/env python3
"""
Migration script to add unique_token column to guests table.
Run this in Render Shell: python migrate_add_unique_token.py
"""

from src.main import create_app
from src.models import db, Guest
from sqlalchemy import text, inspect

def migrate():
    app = create_app()
    with app.app_context():
        print("=" * 60)
        print("Adding unique_token column to guests table")
        print("=" * 60)
        print()
        
        inspector = inspect(db.engine)
        columns = [col['name'] for col in inspector.get_columns('guests')]
        
        if 'unique_token' in columns:
            print("✅ 'unique_token' column already exists")
        else:
            print("Adding 'unique_token' column...")
            try:
                db.session.execute(text("""
                    ALTER TABLE guests 
                    ADD COLUMN unique_token VARCHAR(64) UNIQUE
                """))
                db.session.commit()
                print("✅ Added 'unique_token' column")
                
                # Generate tokens for existing guests
                print("\nGenerating unique tokens for existing guests...")
                guests = Guest.query.all()
                for guest in guests:
                    if not guest.unique_token:
                        guest.unique_token = Guest.generate_unique_token()
                        # Ensure uniqueness
                        while Guest.query.filter_by(unique_token=guest.unique_token).filter(Guest.id != guest.id).first():
                            guest.unique_token = Guest.generate_unique_token()
                db.session.commit()
                print(f"✅ Generated tokens for {len(guests)} existing guests")
                
            except Exception as e:
                print(f"❌ Error: {e}")
                db.session.rollback()
                raise
        
        # Make unique_token NOT NULL after generating tokens
        try:
            db.session.execute(text("""
                ALTER TABLE guests 
                ALTER COLUMN unique_token SET NOT NULL
            """))
            db.session.commit()
            print("✅ Set unique_token to NOT NULL")
        except Exception as e:
            print(f"⚠️  Could not set NOT NULL constraint: {e}")
            # This might fail if there are still NULL values, which is okay
        
        print()
        print("=" * 60)
        print("Migration complete!")
        print("=" * 60)

if __name__ == '__main__':
    migrate()

