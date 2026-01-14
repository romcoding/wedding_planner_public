"""
Database migration script to add vendor_contact and receipt_url to costs table
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
        print("Database Migration: Adding Receipt & Vendor Contact to Costs")
        print("=" * 60)
        print()

        try:
            inspector = inspect(db.engine)
            
            if not inspector.has_table('costs'):
                print("⚠️  Costs table does not exist. Please create it first.")
                return
            
            columns = [col['name'] for col in inspector.get_columns('costs')]
            print(f"Current columns: {', '.join(columns)}")
            print()

            # Add vendor_name if it doesn't exist
            if 'vendor_name' not in columns:
                print("Adding 'vendor_name' column to 'costs' table...")
                try:
                    db.session.execute(text("ALTER TABLE costs ADD COLUMN vendor_name VARCHAR(200)"))
                    db.session.commit()
                    print("✅ Added 'vendor_name' column.")
                except Exception as e:
                    print(f"❌ Error adding vendor_name: {e}")
                    db.session.rollback()
            else:
                print("✓ 'vendor_name' column already exists.")
            
            # Add vendor_contact
            if 'vendor_contact' not in columns:
                print("Adding 'vendor_contact' column to 'costs' table...")
                try:
                    db.session.execute(text("ALTER TABLE costs ADD COLUMN vendor_contact VARCHAR(500)"))
                    db.session.commit()
                    print("✅ Added 'vendor_contact' column.")
                except Exception as e:
                    print(f"❌ Error adding vendor_contact: {e}")
                    db.session.rollback()
            else:
                print("✓ 'vendor_contact' column already exists.")
            
            # Add receipt_url
            if 'receipt_url' not in columns:
                print("Adding 'receipt_url' column to 'costs' table...")
                try:
                    db.session.execute(text("ALTER TABLE costs ADD COLUMN receipt_url VARCHAR(500)"))
                    db.session.commit()
                    print("✅ Added 'receipt_url' column.")
                except Exception as e:
                    print(f"❌ Error adding receipt_url: {e}")
                    db.session.rollback()
            else:
                print("✓ 'receipt_url' column already exists.")
            
            # Migrate existing vendor data to vendor_name
            if 'vendor_name' in columns and 'vendor' in columns:
                print("\nMigrating existing vendor data to vendor_name...")
                try:
                    result = db.session.execute(text("""
                        UPDATE costs 
                        SET vendor_name = vendor 
                        WHERE vendor_name IS NULL AND vendor IS NOT NULL
                    """))
                    db.session.commit()
                    print(f"✅ Migrated {result.rowcount} vendor values to vendor_name.")
                except Exception as e:
                    print(f"❌ Error migrating vendor data: {e}")
                    db.session.rollback()

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
