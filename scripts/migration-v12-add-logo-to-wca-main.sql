-- Migration v12: Add logo_url to wca_main table for easier querying

-- Add logo_url column to wca_main table
ALTER TABLE wca_main ADD COLUMN IF NOT EXISTS logo_url TEXT;

-- Populate logo_url from tickers table for existing records
UPDATE wca_main
SET logo_url = tickers.logo_url
FROM tickers
WHERE wca_main.symbol = tickers.symbol
  AND wca_main.logo_url IS NULL;

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_wca_main_logo ON wca_main (symbol) WHERE logo_url IS NOT NULL;

-- Note: The ingest job should update logo_url in wca_main when updating from tickers
