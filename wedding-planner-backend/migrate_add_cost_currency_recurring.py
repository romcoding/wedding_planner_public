#!/usr/bin/env python3
"""
Migration: Add currency and recurring cost fields to costs table
"""
import sys
import os

# Add parent directory to path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from src.models import db
from src.main import create_app

def migrate():
    app = create_app()
    with app.app_context():
        try:
            # Check if currency column exists
            result = db.engine.execute("""
                SELECT column_name 
                FROM information_schema.columns 
                WHERE table_name='costs' AND column_name='currency'
            """)
            currency_exists = result.fetchone() is not None
            
            if not currency_exists:
                db.engine.execute("""
                    ALTER TABLE costs 
                    ADD COLUMN currency VARCHAR(3) DEFAULT 'EUR'
                """)
                print("✓ Added currency column to costs table")
            else:
                print("✓ Currency column already exists")
            
            # Check if is_recurring column exists
            result = db.engine.execute("""
                SELECT column_name 
                FROM information_schema.columns 
                WHERE table_name='costs' AND column_name='is_recurring'
            """)
            recurring_exists = result.fetchone() is not None
            
            if not recurring_exists:
                db.engine.execute("""
                    ALTER TABLE costs 
                    ADD COLUMN is_recurring BOOLEAN DEFAULT FALSE
                """)
                print("✓ Added is_recurring column to costs table")
            else:
                print("✓ is_recurring column already exists")
            
            # Check if recurring_frequency column exists
            result = db.engine.execute("""
                SELECT column_name 
                FROM information_schema.columns 
                WHERE table_name='costs' AND column_name='recurring_frequency'
            """)
            frequency_exists = result.fetchone() is not None
            
            if not frequency_exists:
                db.engine.execute("""
                    ALTER TABLE costs 
                    ADD COLUMN recurring_frequency VARCHAR(20)
                """)
                print("✓ Added recurring_frequency column to costs table")
            else:
                print("✓ recurring_frequency column already exists")
            
            db.session.commit()
            print("✓ Migration completed successfully")
            
        except Exception as e:
            db.session.rollback()
            print(f"✗ Migration failed: {e}")
            sys.exit(1)

if __name__ == '__main__':
    migrate()
