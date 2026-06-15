-- Migration 004: wedding-website builder (structured-content sites)
-- Apply with:
--   npx wrangler d1 execute wedding-planner-db --file=wedding-planner-backend/migrations/004_website.sql
--
-- Idempotent: every statement is IF NOT EXISTS, so re-running is safe. These
-- tables also live in schema.sql for fresh databases.
--
-- A wedding's public website is a structured JSON document of typed blocks,
-- validated by services/site_schema.py (the authoritative validator). No user-
-- or model-authored HTML is ever stored: themes render the typed blocks.
--
-- ID TYPES: every other table uses TEXT uuid ids, and weddings.id / guests.id
-- are TEXT. These website tables use their own INTEGER rowid PK (monotonic —
-- relied on to prune revisions to the most recent 10), but each FOREIGN KEY
-- column keeps its referent's actual type:
--   wedding_id       -> weddings(id)       TEXT
--   matched_guest_id -> guests(id)         TEXT
--   site_id          -> wedding_sites(id)  INTEGER

-- 1. One website per wedding. custom_host is reserved for the later
--    wildcard-domain phase. password_hash is an optional guest password,
--    hashed with the same PBKDF2 helper as user passwords (auth).
CREATE TABLE IF NOT EXISTS wedding_sites (
  id INTEGER PRIMARY KEY,
  wedding_id TEXT NOT NULL UNIQUE REFERENCES weddings(id),
  slug TEXT NOT NULL UNIQUE,
  custom_host TEXT UNIQUE,
  theme TEXT NOT NULL DEFAULT 'classic',
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','published','unpublished')),
  draft_content TEXT NOT NULL DEFAULT '{}',
  published_snapshot TEXT,
  published_at TEXT,
  rsvp_enabled INTEGER NOT NULL DEFAULT 1,
  password_hash TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_wedding_sites_slug ON wedding_sites(slug);
CREATE INDEX IF NOT EXISTS idx_wedding_sites_custom_host ON wedding_sites(custom_host);

-- 2. Immutable published snapshots — one row inserted on every publish, then
--    pruned to the most recent 10 per site (ordered by the monotonic id).
CREATE TABLE IF NOT EXISTS site_revisions (
  id INTEGER PRIMARY KEY,
  site_id INTEGER NOT NULL REFERENCES wedding_sites(id),
  snapshot TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_site_revisions_site ON site_revisions(site_id);

-- 3. Public website RSVP responses.
--    DISTINCT from the existing guest-token RSVP flow (guest_routes: one row per
--    invited guest, authenticated by guests.unique_token, writes
--    guests.rsvp_status). This is the OPEN public-website form: anyone may
--    submit, there is no token, and we best-effort fuzzy-match to an existing
--    guest (matched_guest_id) without requiring one.
CREATE TABLE IF NOT EXISTS site_rsvp_responses (
  id INTEGER PRIMARY KEY,
  wedding_id TEXT NOT NULL REFERENCES weddings(id),
  site_id INTEGER NOT NULL REFERENCES wedding_sites(id),
  guest_name TEXT NOT NULL,
  email TEXT,
  attending INTEGER NOT NULL,
  party_size INTEGER NOT NULL DEFAULT 1,
  dietary TEXT,
  message TEXT,
  matched_guest_id TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_site_rsvp_responses_wedding ON site_rsvp_responses(wedding_id);
CREATE INDEX IF NOT EXISTS idx_site_rsvp_responses_site ON site_rsvp_responses(site_id);
