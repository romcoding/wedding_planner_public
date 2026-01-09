"""
Database migration script to add analytics and security tracking tables
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
        print("Database Migration: Adding Analytics & Security Tables")
        print("=" * 60)
        print()

        try:
            inspector = inspect(db.engine)
            
            # Create page_views table
            if not inspector.has_table('page_views'):
                print("Creating 'page_views' table...")
                try:
                    with db.engine.connect() as conn:
                        conn.execute(text("""
                            CREATE TABLE page_views (
                                id INTEGER PRIMARY KEY,
                                user_id INTEGER REFERENCES users(id),
                                guest_id INTEGER REFERENCES guests(id),
                                page_path VARCHAR(500) NOT NULL,
                                page_title VARCHAR(200),
                                referrer VARCHAR(500),
                                user_agent VARCHAR(500),
                                ip_address VARCHAR(45),
                                session_id VARCHAR(100),
                                is_guest BOOLEAN DEFAULT FALSE,
                                viewed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                                FOREIGN KEY (user_id) REFERENCES users(id),
                                FOREIGN KEY (guest_id) REFERENCES guests(id)
                            )
                        """))
                        conn.execute(text("CREATE INDEX idx_page_views_viewed_at ON page_views(viewed_at)"))
                        conn.execute(text("CREATE INDEX idx_page_views_session_id ON page_views(session_id)"))
                        conn.commit()
                    print("✅ Created 'page_views' table with indexes.")
                except Exception as e:
                    print(f"❌ Error creating page_views table: {e}")
                    db.session.rollback()
            else:
                print("✓ 'page_views' table already exists.")
            
            # Create visits table
            if not inspector.has_table('visits'):
                print("Creating 'visits' table...")
                try:
                    with db.engine.connect() as conn:
                        conn.execute(text("""
                            CREATE TABLE visits (
                                id INTEGER PRIMARY KEY,
                                user_id INTEGER REFERENCES users(id),
                                guest_id INTEGER REFERENCES guests(id),
                                session_id VARCHAR(100) UNIQUE NOT NULL,
                                ip_address VARCHAR(45),
                                user_agent VARCHAR(500),
                                referrer VARCHAR(500),
                                is_guest BOOLEAN DEFAULT FALSE,
                                started_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                                ended_at TIMESTAMP,
                                duration_seconds INTEGER,
                                page_count INTEGER DEFAULT 1,
                                FOREIGN KEY (user_id) REFERENCES users(id),
                                FOREIGN KEY (guest_id) REFERENCES guests(id)
                            )
                        """))
                        conn.execute(text("CREATE INDEX idx_visits_session_id ON visits(session_id)"))
                        conn.execute(text("CREATE INDEX idx_visits_started_at ON visits(started_at)"))
                        conn.commit()
                    print("✅ Created 'visits' table with indexes.")
                except Exception as e:
                    print(f"❌ Error creating visits table: {e}")
                    db.session.rollback()
            else:
                print("✓ 'visits' table already exists.")
            
            # Create security_events table
            if not inspector.has_table('security_events'):
                print("Creating 'security_events' table...")
                try:
                    with db.engine.connect() as conn:
                        conn.execute(text("""
                            CREATE TABLE security_events (
                                id INTEGER PRIMARY KEY,
                                user_id INTEGER REFERENCES users(id),
                                event_type VARCHAR(50) NOT NULL,
                                ip_address VARCHAR(45) NOT NULL,
                                user_agent VARCHAR(500),
                                details TEXT,
                                severity VARCHAR(20) DEFAULT 'medium',
                                occurred_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                                FOREIGN KEY (user_id) REFERENCES users(id)
                            )
                        """))
                        conn.execute(text("CREATE INDEX idx_security_events_type ON security_events(event_type)"))
                        conn.execute(text("CREATE INDEX idx_security_events_ip ON security_events(ip_address)"))
                        conn.execute(text("CREATE INDEX idx_security_events_occurred_at ON security_events(occurred_at)"))
                        conn.commit()
                    print("✅ Created 'security_events' table with indexes.")
                except Exception as e:
                    print(f"❌ Error creating security_events table: {e}")
                    db.session.rollback()
            else:
                print("✓ 'security_events' table already exists.")

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
