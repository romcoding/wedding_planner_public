-- Migration v2: lifetime plan support + webhook idempotency
-- Apply with: npx wrangler d1 execute wedding-planner-db --file=wedding-planner-backend/migration_v2.sql
--
-- Idempotent — safe to run multiple times. The plan / stripe_customer_id /
-- stripe_subscription_id columns already exist in v1 schema.sql so only the
-- two genuinely new things are added here:
--   1. weddings.plan_expires_at        (TEXT, nullable) — used for lifetime / annual upgrades
--   2. stripe_events                   (TABLE)          — webhook idempotency log

-- D1 (SQLite) doesn't support `ADD COLUMN IF NOT EXISTS`. If the column
-- already exists, the ALTER will raise "duplicate column name" — that's
-- safe; treat it as success. Run each statement separately if your tooling
-- aborts on error.

ALTER TABLE weddings ADD COLUMN plan_expires_at TEXT;

CREATE TABLE IF NOT EXISTS stripe_events (
  id TEXT PRIMARY KEY,
  event_type TEXT NOT NULL,
  processed_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_stripe_events_type ON stripe_events(event_type);
