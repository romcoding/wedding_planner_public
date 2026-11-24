-- Migration 008: one-off cleanup of orphaned seat assignments.
-- delete_guest used to SET guest_id = NULL on seat_assignments, leaving seats
-- that point at nobody. It now deletes them; this removes the existing ones.
-- Idempotent.
DELETE FROM seat_assignments WHERE guest_id IS NULL;
