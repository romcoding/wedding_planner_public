"""
Database migration script to add RBAC fields to users table
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
        print("Database Migration: Adding RBAC Fields to Users Table")
        print("=" * 60)
        print()

        try:
            inspector = inspect(db.engine)
            
            if not inspector.has_table('users'):
                print("⚠️  Users table does not exist. Please create it first.")
                return
            
            columns = [col['name'] for col in inspector.get_columns('users')]
            print(f"Current columns: {', '.join(columns)}")
            print()

            new_columns = {
                'is_active': 'BOOLEAN DEFAULT TRUE',
                'permissions': 'TEXT'
            }
            
            for col_name, col_type in new_columns.items():
                if col_name not in columns:
                    print(f"Adding '{col_name}' column to 'users' table...")
                    try:
                        with db.engine.connect() as conn:
                            conn.execute(text(f"ALTER TABLE users ADD COLUMN {col_name} {col_type}"))
                            conn.commit()
                        print(f"✅ Added '{col_name}' column.")
                    except Exception as e:
                        print(f"❌ Error adding {col_name}: {e}")
                        db.session.rollback()
                else:
                    print(f"✓ '{col_name}' column already exists.")

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
