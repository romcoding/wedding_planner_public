-- Migration 005: Wedi website-generation usage ledger
-- Apply with:
--   npx wrangler d1 execute wedding-planner-db --file=wedding-planner-backend/migrations/005_wedi_usage.sql
--
-- Idempotent: every statement is IF NOT EXISTS, so re-running is safe. These
-- tables also live in schema.sql for fresh databases.
--
-- This is a SEPARATE ledger from the legacy ai_usage / token_usage daily-cap
-- tables — it must NOT overload them. It backs the monthly budget for the
-- "Wedi designs your website" feature: a generation counter plus the actual
-- token totals reported by the model, keyed by a UTC 'YYYY-MM' period so the
-- monthly reset is implicit (no cron job).
--
-- ID TYPES: every other table uses TEXT uuid ids, and weddings.id is TEXT (004
-- already had to make wedding_sites.wedding_id TEXT for this reason). These
-- tables keep their own INTEGER rowid PK (monotonic ordering), but the
-- wedding_id FOREIGN KEY column keeps its referent's actual type:
--   wedding_id -> weddings(id)  TEXT

-- 1. Monthly usage counters, one row per (wedding, period). record_usage does an
--    UPSERT on the UNIQUE(wedding_id, period) constraint.
CREATE TABLE IF NOT EXISTS wedi_site_usage (
  id INTEGER PRIMARY KEY,
  wedding_id TEXT NOT NULL REFERENCES weddings(id),
  period TEXT NOT NULL,                     -- 'YYYY-MM' (UTC); monthly reset is implicit
  generations INTEGER NOT NULL DEFAULT 0,
  input_tokens INTEGER NOT NULL DEFAULT 0,
  output_tokens INTEGER NOT NULL DEFAULT 0,
  UNIQUE(wedding_id, period)
);

CREATE INDEX IF NOT EXISTS idx_wedi_site_usage_wedding ON wedi_site_usage(wedding_id);

-- 2. Append-only audit of every generation attempt (one row per attempt), used
--    for reconciling against the model provider's console and diagnosing
--    failures. status is constrained to the three outcomes the route records.
CREATE TABLE IF NOT EXISTS wedi_generation_log (
  id INTEGER PRIMARY KEY,
  wedding_id TEXT NOT NULL REFERENCES weddings(id),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  model TEXT,
  input_tokens INTEGER NOT NULL DEFAULT 0,
  output_tokens INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL CHECK (status IN ('ok','error','over_limit')),
  purpose TEXT
);

CREATE INDEX IF NOT EXISTS idx_wedi_generation_log_wedding ON wedi_generation_log(wedding_id);
