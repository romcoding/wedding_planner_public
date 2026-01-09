"""
Database migration script to add invitation templates and tracking
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
        print("Database Migration: Adding Invitation Templates & Tracking")
        print("=" * 60)
        print()

        try:
            inspector = inspect(db.engine)
            
            # Create invitation_templates table
            if not inspector.has_table('invitation_templates'):
                print("Creating 'invitation_templates' table...")
                try:
                    with db.engine.connect() as conn:
                        conn.execute(text("""
                            CREATE TABLE invitation_templates (
                                id INTEGER PRIMARY KEY,
                                user_id INTEGER NOT NULL,
                                name VARCHAR(200) NOT NULL,
                                subject VARCHAR(500) NOT NULL,
                                html_content TEXT NOT NULL,
                                is_default BOOLEAN DEFAULT FALSE,
                                is_active BOOLEAN DEFAULT TRUE,
                                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                                FOREIGN KEY (user_id) REFERENCES users(id)
                            )
                        """))
                        conn.commit()
                    print("✅ Created 'invitation_templates' table.")
                except Exception as e:
                    print(f"❌ Error creating invitation_templates table: {e}")
                    db.session.rollback()
            else:
                print("✓ 'invitation_templates' table already exists.")
            
            # Add tracking columns to invitations table
            if inspector.has_table('invitations'):
                columns = [col['name'] for col in inspector.get_columns('invitations')]
                
                new_columns = {
                    'template_id': 'INTEGER REFERENCES invitation_templates(id)',
                    'scheduled_at': 'TIMESTAMP',
                    'opened_at': 'TIMESTAMP',
                    'opened_count': 'INTEGER DEFAULT 0',
                    'clicked_at': 'TIMESTAMP',
                    'clicked_count': 'INTEGER DEFAULT 0'
                }
                
                for col_name, col_type in new_columns.items():
                    if col_name not in columns:
                        print(f"Adding '{col_name}' column to 'invitations' table...")
                        try:
                            with db.engine.connect() as conn:
                                conn.execute(text(f"ALTER TABLE invitations ADD COLUMN {col_name} {col_type}"))
                                conn.commit()
                            print(f"✅ Added '{col_name}' column.")
                        except Exception as e:
                            print(f"❌ Error adding {col_name}: {e}")
                            db.session.rollback()
                    else:
                        print(f"✓ '{col_name}' column already exists.")
            else:
                print("⚠️  'invitations' table does not exist. Please create it first.")

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
