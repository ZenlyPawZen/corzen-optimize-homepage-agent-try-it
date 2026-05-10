-- Run this in your Supabase SQL editor.

CREATE TABLE IF NOT EXISTS homepage_audit_sessions (
  id                   UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  email                TEXT        UNIQUE NOT NULL,
  beehiiv_tag          TEXT        NOT NULL DEFAULT 'Homepage audit demo',
  email_opt_in         BOOLEAN     NOT NULL DEFAULT false,

  -- Page inputs collected before the chat intake. At least one of url /
  -- pasted_content / screenshot_path is required by the UI; the DB does not
  -- enforce that — application code does.
  homepage_url         TEXT,
  pasted_content       TEXT,
  screenshot_path      TEXT,        -- key inside the homepage-audit-screenshots storage bucket

  intake_history       JSONB       NOT NULL DEFAULT '[]'::jsonb,
  brand_voice_context  TEXT,        -- optionally populated by Notion brand-voice import
  report_content       TEXT,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at           TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS homepage_audit_sessions_email_idx ON homepage_audit_sessions (email);

-- Row-level security (service role bypasses RLS — the Next.js API routes use
-- SUPABASE_SERVICE_ROLE_KEY)
ALTER TABLE homepage_audit_sessions ENABLE ROW LEVEL SECURITY;

-- ─── Email policy ────────────────────────────────────────────────────────────
-- The UNIQUE constraint on email is scoped to THIS table only. The same email
-- can be reused across other CorZen agent demos that have their own tables
-- (e.g. li_demo_sessions). Within this demo, each email runs the audit once.
--
-- ─── Storage bucket setup (manual step) ─────────────────────────────────────
-- This migration does NOT create the screenshot bucket. Create it in the
-- Supabase dashboard:
--   1. Storage → Create bucket → name: homepage-audit-screenshots → private
--   2. Add a service-role policy granting full access (default policies for
--      private buckets already restrict public reads).
--
-- ─── Beehiiv edge function setup ────────────────────────────────────────────
-- After deploying supabase/functions/beehiiv-homepage-demo-sync, set these
-- two secrets in the Supabase dashboard → Edge Functions → Secrets:
--
--   BEEHIIV_API_KEY   your Beehiiv API key
--   BEEHIIV_PUB_ID    your Beehiiv publication ID
--
-- The Next.js /api/session route calls the edge function directly via HTTP.
