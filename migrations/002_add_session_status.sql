-- Run this in your Supabase SQL editor after 001_create_homepage_audit_sessions.sql
--
-- Adds magic-link email gate columns:
--   status     — 'pending' until the user clicks their link; 'active' after
--   expires_at — when the magic link expires (48 h from creation)
--
-- Existing rows (if any) are set to 'active' so live sessions are unaffected.

ALTER TABLE homepage_audit_sessions
  ADD COLUMN IF NOT EXISTS status     TEXT        NOT NULL DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS expires_at TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '48 hours');

-- Backfill any existing sessions to 'active' so they aren't locked out.
UPDATE homepage_audit_sessions SET status = 'active' WHERE status = 'pending';

CREATE INDEX IF NOT EXISTS homepage_audit_sessions_status_idx
  ON homepage_audit_sessions (status);
