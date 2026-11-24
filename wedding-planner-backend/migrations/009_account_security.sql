-- Migration 009: account security.
--  * users.token_version   — JWTs carry it; bumping it revokes every session
--                            (password reset/change, deactivation).
--  * users.pending_email   — an email change awaiting verification. The old
--                            email stays the active login until the new one is
--                            verified.
--  * email_verifications.new_email — marks a token as "verify this NEW address".
-- Each ALTER raises "duplicate column name" if already applied — safe to ignore.
ALTER TABLE users ADD COLUMN token_version INTEGER NOT NULL DEFAULT 0;
ALTER TABLE users ADD COLUMN pending_email TEXT;
ALTER TABLE email_verifications ADD COLUMN new_email TEXT;
