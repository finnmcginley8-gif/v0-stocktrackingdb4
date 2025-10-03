-- Migration v4: Add ingest runs logging table
-- This table tracks all ingest runs (manual and cron) with detailed metrics

CREATE TABLE IF NOT EXISTS wca_ingest_runs (
  id BIGSERIAL PRIMARY KEY,
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  finished_at TIMESTAMPTZ,
  trigger TEXT NOT NULL CHECK (trigger IN ('cron', 'manual')),
  processed INT NOT NULL DEFAULT 0,
  updated_main INT NOT NULL DEFAULT 0,
  upserted_history INT NOT NULL DEFAULT 0,
  upserted_5y INT NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'running' CHECK (status IN ('running', 'success', 'error')),
  error TEXT
);

-- Indexes for efficient querying
CREATE INDEX IF NOT EXISTS idx_ingest_runs_started_at ON wca_ingest_runs (started_at DESC);
CREATE INDEX IF NOT EXISTS idx_ingest_runs_status ON wca_ingest_runs (status);

-- Enable RLS (will use service role for writes)
ALTER TABLE wca_ingest_runs ENABLE ROW LEVEL SECURITY;

-- Grant permissions to service role
GRANT ALL ON wca_ingest_runs TO service_role;
GRANT USAGE, SELECT ON SEQUENCE wca_ingest_runs_id_seq TO service_role;
