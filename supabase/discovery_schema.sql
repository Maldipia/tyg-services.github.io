-- ============================================================
-- TYG POS — Discovery Responses Table
-- Run this in Supabase SQL Editor
-- ============================================================

CREATE TABLE IF NOT EXISTS discovery_responses (
  id                        UUID DEFAULT gen_random_uuid() PRIMARY KEY,

  -- Business Info
  business_name             TEXT NOT NULL,
  business_type             TEXT,
  branch_count              TEXT DEFAULT '1',
  location                  TEXT,
  years_operating           TEXT,

  -- Current Ops
  current_pos               TEXT,
  current_ordering          TEXT,
  pain_points               TEXT[] DEFAULT '{}',

  -- Goals
  primary_goal              TEXT,
  monthly_transaction_volume TEXT,
  budget_range              TEXT,
  timeline                  TEXT,

  -- Contact
  contact_name              TEXT NOT NULL,
  contact_email             TEXT NOT NULL,
  contact_phone             TEXT NOT NULL,
  best_time_to_call         TEXT,
  notes                     TEXT,

  -- Internal
  status                    TEXT NOT NULL DEFAULT 'new'
                            CHECK (status IN ('new','contacted','qualified','converted','not_a_fit')),
  internal_assessment       TEXT,

  created_at                TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at                TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_discovery_status     ON discovery_responses(status);
CREATE INDEX IF NOT EXISTS idx_discovery_created_at ON discovery_responses(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_discovery_email      ON discovery_responses(contact_email);

-- RLS: public insert (the form), superadmin reads via service role key
ALTER TABLE discovery_responses ENABLE ROW LEVEL SECURITY;

-- Allow anyone to INSERT (public form submission)
CREATE POLICY "discovery_public_insert"
  ON discovery_responses FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

-- Block public SELECT (only service role key used by API routes can read)
CREATE POLICY "discovery_no_public_read"
  ON discovery_responses FOR SELECT
  TO anon
  USING (false);

-- Authenticated users (admin) can read their own records (not needed for now, service role handles it)
-- Service role key bypasses RLS entirely — our API routes use that.

-- Auto-update updated_at
CREATE OR REPLACE FUNCTION update_discovery_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_discovery_updated_at ON discovery_responses;
CREATE TRIGGER trg_discovery_updated_at
  BEFORE UPDATE ON discovery_responses
  FOR EACH ROW EXECUTE FUNCTION update_discovery_updated_at();
