-- supabase/migrations/007_webhook_sync.sql
-- Retry queue for failed Google Apps Script webhook calls
-- Used by /api/cron/retry-webhooks every 15 minutes

CREATE TABLE IF NOT EXISTS pending_webhook_syncs (
  id             UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  action         TEXT NOT NULL,
  payload        JSONB NOT NULL DEFAULT '{}',
  retry_count    INTEGER NOT NULL DEFAULT 0,
  next_retry_at  TIMESTAMPTZ NOT NULL DEFAULT NOW() + INTERVAL '15 minutes',
  last_error     TEXT,
  error_reason   TEXT,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index for the cron query (due retries, not exhausted)
CREATE INDEX idx_pending_webhook_syncs_due
  ON pending_webhook_syncs (next_retry_at, retry_count)
  WHERE retry_count < 5;

-- Auto-purge rows older than 7 days (belt-and-suspenders)
CREATE OR REPLACE FUNCTION purge_old_webhook_syncs()
RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  DELETE FROM pending_webhook_syncs
  WHERE created_at < NOW() - INTERVAL '7 days';
END;
$$;

-- RLS: only service role accesses this table
ALTER TABLE pending_webhook_syncs ENABLE ROW LEVEL SECURITY;
-- No SELECT/INSERT/UPDATE/DELETE policies for anon — service role bypasses RLS
