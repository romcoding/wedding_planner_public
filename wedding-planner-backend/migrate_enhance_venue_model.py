"""
Database migration script to enhance venues table with new fields
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
        print("Database Migration: Enhancing Venues Table")
        print("=" * 60)
        print()

        try:
            inspector = inspect(db.engine)
            
            if not inspector.has_table('venues'):
                print("⚠️  Venues table does not exist. Please create it first.")
                return
            
            columns = [col['name'] for col in inspector.get_columns('venues')]
            print(f"Current columns: {', '.join(columns)}")
            print()

            # New fields to add
            new_fields = [
                ('address', 'VARCHAR(500)'),
                ('city', 'VARCHAR(100)'),
                ('region', 'VARCHAR(100)'),
                ('capacity_min', 'INTEGER'),
                ('capacity_max', 'INTEGER'),
                ('price_min', 'NUMERIC(10, 2)'),
                ('price_max', 'NUMERIC(10, 2)'),
                ('external_url', 'VARCHAR(500)'),
                ('available_dates', 'TEXT'),
                ('images', 'TEXT'),
                ('imported_via_scraper', 'BOOLEAN DEFAULT FALSE'),
            ]

            for field_name, field_type in new_fields:
                if field_name not in columns:
                    print(f"Adding '{field_name}' column to 'venues' table...")
                    try:
                        with db.engine.connect() as conn:
                            conn.execute(text(f"ALTER TABLE venues ADD COLUMN {field_name} {field_type}"))
                            conn.commit()
                        print(f"✅ Added '{field_name}' column.")
                    except Exception as e:
                        print(f"❌ Error adding '{field_name}': {e}")
                        db.session.rollback()
                else:
                    print(f"✓ '{field_name}' column already exists.")

            # Migrate existing data
            print("\nMigrating existing data...")
            with db.engine.connect() as conn:
                # Migrate capacity to capacity_max if capacity_max is null
                result = conn.execute(text("""
                    UPDATE venues 
                    SET capacity_max = capacity 
                    WHERE capacity_max IS NULL AND capacity IS NOT NULL
                """))
                conn.commit()
                print(f"✅ Migrated {result.rowcount} capacity values to capacity_max.")

                # Try to parse price_range and extract min/max if possible
                # This is a simple heuristic - can be improved
                result = conn.execute(text("""
                    UPDATE venues 
                    SET price_min = CAST(SUBSTRING(price_range FROM '\\$?([0-9,]+)') AS NUMERIC),
                        price_max = CAST(SUBSTRING(price_range FROM '\\$?([0-9,]+)' FROM 2) AS NUMERIC)
                    WHERE price_range IS NOT NULL 
                      AND price_range ~ '\\$?[0-9,]+'
                      AND (price_min IS NULL OR price_max IS NULL)
                """))
                conn.commit()
                print(f"✅ Attempted to extract price_min/max from {result.rowcount} price_range values.")

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
