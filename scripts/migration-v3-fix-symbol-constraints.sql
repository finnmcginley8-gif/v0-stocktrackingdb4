-- Migration v3: Fix symbol constraints for proper upsert behavior
-- Drop case-insensitive index and enforce uppercase symbols

-- Drop the existing case-insensitive unique index if it exists
DROP INDEX IF EXISTS wca_main_symbol_lower_uidx;

-- Add CHECK constraint to enforce uppercase symbols
-- This ensures all symbols are stored consistently in uppercase
ALTER TABLE wca_main 
  ADD CONSTRAINT wca_main_symbol_upper_chk CHECK (symbol = upper(symbol));

-- Create a plain unique index on the symbol column
-- This works with the upsert onConflict = "symbol" behavior
CREATE UNIQUE INDEX wca_main_symbol_uidx ON wca_main (symbol);

-- Verify the constraint works by updating any existing lowercase symbols
-- (This should be safe since we're already normalizing to uppercase in the API)
UPDATE wca_main SET symbol = upper(symbol) WHERE symbol != upper(symbol);

-- Add comment explaining the constraint
COMMENT ON CONSTRAINT wca_main_symbol_upper_chk ON wca_main IS 
  'Ensures all symbols are stored in uppercase for consistent upsert behavior';

-- Verify RLS is still enabled (should already be set from migration v2)
SELECT schemaname, tablename, rowsecurity 
FROM pg_tables 
WHERE tablename IN ('wca_main', 'wca_history', 'wca_alerts', 'wca_chart_5y')
  AND schemaname = 'public';
