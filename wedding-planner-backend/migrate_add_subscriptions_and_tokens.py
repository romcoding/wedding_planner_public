"""Migration: add user_subscriptions and token_usage tables."""
import os
from sqlalchemy import create_engine, text
from dotenv import load_dotenv

load_dotenv()


def get_database_url():
    database_url = os.getenv('DATABASE_URL')
    if not database_url:
        return 'sqlite:///wedding_planner.db'
    if database_url.startswith('postgres://'):
        return database_url.replace('postgres://', 'postgresql://', 1)
    return database_url


def run_migration():
    engine = create_engine(get_database_url())

    with engine.begin() as conn:
        conn.execute(text('''
            CREATE TABLE IF NOT EXISTS user_subscriptions (
                id INTEGER PRIMARY KEY,
                user_id INTEGER NOT NULL UNIQUE,
                plan_type VARCHAR(20) NOT NULL DEFAULT 'free',
                balance_tokens INTEGER NOT NULL DEFAULT 100,
                is_active BOOLEAN NOT NULL DEFAULT 1,
                created_at DATETIME,
                updated_at DATETIME,
                FOREIGN KEY(user_id) REFERENCES users(id)
            )
        '''))
        conn.execute(text('CREATE INDEX IF NOT EXISTS idx_user_subscriptions_user_id ON user_subscriptions(user_id)'))

        conn.execute(text('''
            CREATE TABLE IF NOT EXISTS token_usage (
                id INTEGER PRIMARY KEY,
                user_id INTEGER NOT NULL,
                feature VARCHAR(64) NOT NULL,
                tokens_consumed INTEGER NOT NULL,
                cost_base FLOAT NOT NULL,
                cost_margin FLOAT NOT NULL,
                created_at DATETIME,
                FOREIGN KEY(user_id) REFERENCES users(id)
            )
        '''))
        conn.execute(text('CREATE INDEX IF NOT EXISTS idx_token_usage_user_id ON token_usage(user_id)'))
        conn.execute(text('CREATE INDEX IF NOT EXISTS idx_token_usage_feature ON token_usage(feature)'))

    print('✅ subscriptions/token usage migration completed')


if __name__ == '__main__':
    run_migration()
