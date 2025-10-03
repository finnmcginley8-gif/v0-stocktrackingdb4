-- Migration v7: Add logo support to tickers table

-- Add logo_url column to tickers table
ALTER TABLE tickers ADD COLUMN IF NOT EXISTS logo_url TEXT;

-- Add index for faster logo lookups
CREATE INDEX IF NOT EXISTS idx_tickers_logo ON tickers (symbol) WHERE logo_url IS NOT NULL;

-- Note: Logo URLs will be populated by the ingest job from a logo vendor API
-- Each ticker will have one shared logo URL used by all users watching that ticker
