-- Migration v2: Add case-insensitive uniqueness, comments, and RLS verification
-- Run this after the initial table creation script

-- Add case-insensitive unique constraint on symbol for wca_main
CREATE UNIQUE INDEX idx_wca_main_symbol_lower ON wca_main (lower(symbol));

-- Add comment on uid column explaining it's generated
COMMENT ON COLUMN wca_main.uid IS 'Do not insert/update uid; generated from symbol.';

-- Verify and enable RLS (Row Level Security) on all tables
-- This ensures proper security when using service role on server

-- Enable RLS on wca_main
ALTER TABLE wca_main ENABLE ROW LEVEL SECURITY;

-- Enable RLS on wca_history  
ALTER TABLE wca_history ENABLE ROW LEVEL SECURITY;

-- Enable RLS on wca_alerts
ALTER TABLE wca_alerts ENABLE ROW LEVEL SECURITY;

-- Enable RLS on wca_chart_5y
ALTER TABLE wca_chart_5y ENABLE ROW LEVEL SECURITY;

-- Create policies for service role access (bypass RLS for service role)
-- This allows server-side operations using service role key

-- Policy for wca_main
CREATE POLICY "Service role can manage wca_main" ON wca_main
    FOR ALL USING (auth.role() = 'service_role');

-- Policy for wca_history
CREATE POLICY "Service role can manage wca_history" ON wca_history
    FOR ALL USING (auth.role() = 'service_role');

-- Policy for wca_alerts  
CREATE POLICY "Service role can manage wca_alerts" ON wca_alerts
    FOR ALL USING (auth.role() = 'service_role');

-- Policy for wca_chart_5y
CREATE POLICY "Service role can manage wca_chart_5y" ON wca_chart_5y
    FOR ALL USING (auth.role() = 'service_role');

-- Verify the changes
SELECT 
    schemaname,
    tablename,
    rowsecurity as rls_enabled
FROM pg_tables 
WHERE tablename LIKE 'wca_%'
ORDER BY tablename;

-- Show the unique constraint was created
SELECT 
    indexname,
    tablename,
    indexdef
FROM pg_indexes 
WHERE tablename = 'wca_main' 
AND indexname = 'idx_wca_main_symbol_lower';

-- Show the comment was added
SELECT 
    column_name,
    col_description(pgc.oid, ordinal_position) as column_comment
FROM information_schema.columns isc
JOIN pg_class pgc ON pgc.relname = isc.table_name
WHERE table_name = 'wca_main' 
AND column_name = 'uid';
