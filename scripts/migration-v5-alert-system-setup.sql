-- Alert System Database Setup
-- Creates indexes and schema changes for the alert system

-- 1) Ensure required indexes exist for efficient alert queries
CREATE INDEX IF NOT EXISTS idx_wca_alerts_uid_time ON wca_alerts (wca_uid, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_wca_history_uid_date ON wca_history (wca_uid, date);
CREATE INDEX IF NOT EXISTS idx_wca_chart_uid_date ON wca_chart_5y (wca_uid, date);

-- 2) Add details column for richer alert payloads
ALTER TABLE wca_alerts ADD COLUMN IF NOT EXISTS details JSONB;

-- 3) Add any missing columns to wca_alerts if needed
ALTER TABLE wca_alerts ADD COLUMN IF NOT EXISTS message TEXT;
ALTER TABLE wca_alerts ADD COLUMN IF NOT EXISTS threshold_value NUMERIC;
ALTER TABLE wca_alerts ADD COLUMN IF NOT EXISTS actual_value NUMERIC;

-- 4) Create index on alert type for faster filtering
CREATE INDEX IF NOT EXISTS idx_wca_alerts_type ON wca_alerts (type);

-- 5) Create composite index for cooldown checks
CREATE INDEX IF NOT EXISTS idx_wca_alerts_uid_type_time ON wca_alerts (wca_uid, type, created_at DESC);

-- Verify the schema
SELECT 
    table_name, 
    column_name, 
    data_type, 
    is_nullable
FROM information_schema.columns 
WHERE table_name = 'wca_alerts' 
ORDER BY ordinal_position;
