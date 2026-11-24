-- Migration 007: moodboards become wedding-scoped, with one JSON document per board.
-- Apply with:
--   npx wrangler d1 execute wedding-planner-db --file=wedding-planner-backend/migrations/007_moodboards_wedding_scope.sql
--
-- * content_json: the whole canvas (stage, grid, palette, objects) as JSON text,
--   replaced atomically by PUT /api/moodboards/{id}/content. Capped at ~1 MB by
--   the API.
-- * wedding_id already exists (nullable) in the base schema; boards created
--   before this migration have it NULL, so backfill it from the owner's current
--   wedding (falling back to their first active owned wedding) so both partners
--   can see the same boards. Boards whose owner has no wedding stay NULL and are
--   unreachable (every query is `AND wedding_id = ?`).
-- * moodboard_elements (row-per-element) is left in place, read-only and unused.
--   The old UI could never reach the old routes (they were mounted without
--   /api), so there is no production data to convert.
--
-- The ADD COLUMN raises "duplicate column name" if already applied — safe to
-- treat as success (same pattern as 003_plans.sql / 006_site_versioning.sql).
ALTER TABLE moodboards ADD COLUMN content_json TEXT NOT NULL DEFAULT '{}';

UPDATE moodboards
SET wedding_id = COALESCE(
  (SELECT u.current_wedding_id FROM users u WHERE u.id = moodboards.user_id),
  (SELECT w.id FROM weddings w WHERE w.owner_id = moodboards.user_id AND w.is_active = 1 LIMIT 1)
)
WHERE wedding_id IS NULL;

CREATE INDEX IF NOT EXISTS idx_moodboards_wedding ON moodboards(wedding_id);
