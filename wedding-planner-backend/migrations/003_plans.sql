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

-- 4. Foreign-key indexes for hot lookups (F25).
CREATE INDEX IF NOT EXISTS idx_seat_assignments_table ON seat_assignments(table_id);
CREATE INDEX IF NOT EXISTS idx_seat_assignments_wedding ON seat_assignments(wedding_id);
CREATE INDEX IF NOT EXISTS idx_seat_assignments_guest ON seat_assignments(guest_id);
CREATE INDEX IF NOT EXISTS idx_venue_chat_history_venue_wedding ON venue_chat_history(venue_id, wedding_id);
CREATE INDEX IF NOT EXISTS idx_venue_requests_wedding ON venue_requests(wedding_id);
CREATE INDEX IF NOT EXISTS idx_venue_offer_categories_venue ON venue_offer_categories(venue_id);
CREATE INDEX IF NOT EXISTS idx_venue_offers_category ON venue_offers(category_id);
CREATE INDEX IF NOT EXISTS idx_venue_documents_venue ON venue_documents(venue_id);
CREATE INDEX IF NOT EXISTS idx_invitation_templates_wedding ON invitation_templates(wedding_id);
CREATE INDEX IF NOT EXISTS idx_moodboards_user ON moodboards(user_id);
CREATE INDEX IF NOT EXISTS idx_moodboard_elements_moodboard ON moodboard_elements(moodboard_id);
CREATE INDEX IF NOT EXISTS idx_token_usage_user ON token_usage(user_id);
CREATE INDEX IF NOT EXISTS idx_reminder_sent_reminder ON reminder_sent(reminder_id);
