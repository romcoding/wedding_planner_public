"""
Migration: SaaS upgrade — multi-tenant, Stripe billing, AI usage tracking.

Creates:
  - weddings table (tenant model)
  - ai_usage table (daily AI call tracking)

Adds columns:
  - users.current_wedding_id
  - guests.wedding_id
  - tasks.wedding_id
  - costs.wedding_id
  - content.wedding_id
  - events.wedding_id

Safe to run multiple times (uses IF NOT EXISTS / checks column existence).
"""
import os
from sqlalchemy import create_engine, text, inspect
from dotenv import load_dotenv

load_dotenv()


def get_database_url():
    database_url = os.getenv('DATABASE_URL')
    if not database_url:
        return 'sqlite:///wedding_planner.db'
    if database_url.startswith('postgres://'):
        return database_url.replace('postgres://', 'postgresql://', 1)
    return database_url


def column_exists(conn, table: str, column: str, db_url: str) -> bool:
    """Check if a column exists in the given table."""
    if db_url.startswith('sqlite'):
        result = conn.execute(text(f"PRAGMA table_info({table})"))
        return any(row[1] == column for row in result)
    else:
        # PostgreSQL
        result = conn.execute(text(
            "SELECT 1 FROM information_schema.columns "
            "WHERE table_name = :t AND column_name = :c"
        ), {'t': table, 'c': column})
        return result.fetchone() is not None


def add_column_if_missing(conn, table: str, column: str, definition: str, db_url: str):
    if not column_exists(conn, table, column, db_url):
        conn.execute(text(f'ALTER TABLE {table} ADD COLUMN {column} {definition}'))
        print(f'  ✓ Added {table}.{column}')
    else:
        print(f'  · {table}.{column} already exists')


def run_migration():
    db_url = get_database_url()
    engine = create_engine(db_url)
    is_sqlite = db_url.startswith('sqlite')

    with engine.begin() as conn:
        print('📦 Creating weddings table...')
        if is_sqlite:
            conn.execute(text('''
                CREATE TABLE IF NOT EXISTS weddings (
                    id VARCHAR(36) PRIMARY KEY,
                    slug VARCHAR(120) NOT NULL UNIQUE,
                    owner_id INTEGER NOT NULL,
                    plan VARCHAR(20) NOT NULL DEFAULT 'free',
                    stripe_customer_id VARCHAR(120),
                    stripe_subscription_id VARCHAR(120),
                    partner_one_name VARCHAR(120),
                    partner_two_name VARCHAR(120),
                    wedding_date DATE,
                    location VARCHAR(255),
                    is_active BOOLEAN NOT NULL DEFAULT 1,
                    created_at DATETIME,
                    updated_at DATETIME,
                    FOREIGN KEY(owner_id) REFERENCES users(id)
                )
            '''))
        else:
            conn.execute(text('''
                CREATE TABLE IF NOT EXISTS weddings (
                    id VARCHAR(36) PRIMARY KEY,
                    slug VARCHAR(120) NOT NULL UNIQUE,
                    owner_id INTEGER NOT NULL,
                    plan VARCHAR(20) NOT NULL DEFAULT 'free',
                    stripe_customer_id VARCHAR(120),
                    stripe_subscription_id VARCHAR(120),
                    partner_one_name VARCHAR(120),
                    partner_two_name VARCHAR(120),
                    wedding_date DATE,
                    location VARCHAR(255),
                    is_active BOOLEAN NOT NULL DEFAULT TRUE,
                    created_at TIMESTAMP,
                    updated_at TIMESTAMP,
                    FOREIGN KEY(owner_id) REFERENCES users(id)
                )
            '''))

        conn.execute(text('CREATE INDEX IF NOT EXISTS idx_weddings_slug ON weddings(slug)'))
        conn.execute(text('CREATE INDEX IF NOT EXISTS idx_weddings_owner_id ON weddings(owner_id)'))
        conn.execute(text('CREATE INDEX IF NOT EXISTS idx_weddings_stripe_customer ON weddings(stripe_customer_id)'))
        print('  ✓ weddings table ready')

        print('📦 Creating ai_usage table...')
        if is_sqlite:
            conn.execute(text('''
                CREATE TABLE IF NOT EXISTS ai_usage (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    wedding_id VARCHAR(36) NOT NULL,
                    usage_date DATE NOT NULL,
                    count INTEGER NOT NULL DEFAULT 0,
                    created_at DATETIME,
                    updated_at DATETIME,
                    FOREIGN KEY(wedding_id) REFERENCES weddings(id),
                    UNIQUE(wedding_id, usage_date)
                )
            '''))
        else:
            conn.execute(text('''
                CREATE TABLE IF NOT EXISTS ai_usage (
                    id SERIAL PRIMARY KEY,
                    wedding_id VARCHAR(36) NOT NULL,
                    usage_date DATE NOT NULL,
                    count INTEGER NOT NULL DEFAULT 0,
                    created_at TIMESTAMP,
                    updated_at TIMESTAMP,
                    FOREIGN KEY(wedding_id) REFERENCES weddings(id),
                    UNIQUE(wedding_id, usage_date)
                )
            '''))

        conn.execute(text('CREATE INDEX IF NOT EXISTS idx_ai_usage_wedding_id ON ai_usage(wedding_id)'))
        conn.execute(text('CREATE INDEX IF NOT EXISTS idx_ai_usage_date ON ai_usage(usage_date)'))
        print('  ✓ ai_usage table ready')

        print('📦 Adding wedding_id columns to existing tables...')
        fk_def = 'VARCHAR(36) REFERENCES weddings(id)'

        add_column_if_missing(conn, 'users', 'current_wedding_id', fk_def, db_url)
        add_column_if_missing(conn, 'guests', 'wedding_id', fk_def, db_url)
        add_column_if_missing(conn, 'tasks', 'wedding_id', fk_def, db_url)
        add_column_if_missing(conn, 'costs', 'wedding_id', fk_def, db_url)
        add_column_if_missing(conn, 'content', 'wedding_id', fk_def, db_url)
        add_column_if_missing(conn, 'events', 'wedding_id', fk_def, db_url)

        # Indexes on new wedding_id columns (safe with IF NOT EXISTS)
        for table in ('guests', 'tasks', 'costs', 'content', 'events'):
            try:
                conn.execute(text(
                    f'CREATE INDEX IF NOT EXISTS idx_{table}_wedding_id ON {table}(wedding_id)'
                ))
            except Exception as e:
                print(f'  · Index on {table}.wedding_id skipped: {e}')

        # Drop old unique constraint on content.key (key is now scoped per wedding)
        # For SQLite we skip this — SQLite doesn't easily drop constraints.
        if not is_sqlite:
            try:
                conn.execute(text('ALTER TABLE content DROP CONSTRAINT IF EXISTS content_key_key'))
                # Re-add as non-unique index
                conn.execute(text('CREATE INDEX IF NOT EXISTS idx_content_key ON content(key)'))
                print('  ✓ Relaxed unique constraint on content.key')
            except Exception as e:
                print(f'  · content.key constraint update skipped: {e}')

    print('\n✅ SaaS upgrade migration completed successfully.')


if __name__ == '__main__':
    run_migration()
