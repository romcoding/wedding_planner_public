-- Migration 003: plan vocabulary consolidation (free | premium | lifetime)
-- Apply with:
--   npx wrangler d1 execute wedding-planner-db --file=wedding-planner-backend/migrations/003_plans.sql
--
-- Idempotent-ish: the ALTERs raise "duplicate column name" if the column
-- already exists (e.g. plan_expires_at from migration_v2.sql) — that is safe,
-- treat it as success. Run statements individually if your tooling aborts on
-- the first error.
--
-- Note: SQLite cannot add a CHECK constraint via ALTER TABLE, so the
-- plan IN ('free','premium','lifetime') constraint lives in schema.sql (fresh
-- DBs). For already-deployed DBs the application enforces the vocabulary
-- (entitlements.VALID_PLANS / the webhook never guesses an unknown price id).

-- 1. Collapse the retired 'starter' tier into 'premium'.
UPDATE weddings SET plan = 'premium' WHERE plan = 'starter';

-- 2. Ensure the billing columns exist on weddings.
--    (plan, stripe_customer_id, stripe_subscription_id already exist in v1.)
ALTER TABLE weddings ADD COLUMN plan_expires_at TEXT;
ALTER TABLE weddings ADD COLUMN plan_updated_at TEXT;

-- 3. Webhook idempotency log (must always exist so _seen_event never silently
--    disables idempotency).
CREATE TABLE IF NOT EXISTS stripe_events (
  id TEXT PRIMARY KEY,
  event_type TEXT NOT NULL,
  processed_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_stripe_events_type ON stripe_events(event_type);
