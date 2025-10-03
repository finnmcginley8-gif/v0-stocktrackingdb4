-- Migration v6: Multi-user architecture with junction tables
-- This creates the three-table structure: users, tickers, user_watchlist

-- Step 1: Create users table (basic structure, no auth yet)
CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    email TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Step 2: Create tickers table (shared stock data)
CREATE TABLE IF NOT EXISTS tickers (
    symbol TEXT PRIMARY KEY,
    uid TEXT GENERATED ALWAYS AS ('wca_' || lower(symbol)) STORED UNIQUE,
    current_quote NUMERIC,
    sma200 NUMERIC,
    delta_to_sma NUMERIC,
    last_updated TIMESTAMPTZ DEFAULT NOW()
);

-- Step 3: Create user_watchlist junction table (user-specific data)
CREATE TABLE IF NOT EXISTS user_watchlist (
    id BIGSERIAL PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    symbol TEXT NOT NULL REFERENCES tickers(symbol) ON DELETE CASCADE,
    target_price NUMERIC NOT NULL,
    delta_to_quote NUMERIC,
    priority TEXT DEFAULT 'None',
    notes TEXT,
    added_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE (user_id, symbol)  -- Each user can only watch a ticker once
);

-- Index for fast lookups by user
CREATE INDEX IF NOT EXISTS idx_user_watchlist_user_id ON user_watchlist (user_id);
CREATE INDEX IF NOT EXISTS idx_user_watchlist_symbol ON user_watchlist (symbol);

-- Step 4: Migrate data from wca_main to new structure
-- First, insert a test user
INSERT INTO users (id, email) VALUES ('test-user-1', 'test@example.com')
ON CONFLICT (id) DO NOTHING;

-- Migrate tickers data
INSERT INTO tickers (symbol, current_quote, sma200, delta_to_sma)
SELECT symbol, current_quote, sma200, delta_to_sma
FROM wca_main
ON CONFLICT (symbol) DO UPDATE SET
    current_quote = EXCLUDED.current_quote,
    sma200 = EXCLUDED.sma200,
    delta_to_sma = EXCLUDED.delta_to_sma,
    last_updated = NOW();

-- Migrate user watchlist data (assign all existing stocks to test user)
INSERT INTO user_watchlist (user_id, symbol, target_price, delta_to_quote, priority)
SELECT 'test-user-1', symbol, target_price, delta_to_quote, COALESCE(priority, 'None')
FROM wca_main
ON CONFLICT (user_id, symbol) DO UPDATE SET
    target_price = EXCLUDED.target_price,
    delta_to_quote = EXCLUDED.delta_to_quote,
    priority = EXCLUDED.priority;

-- Step 5: Update wca_history to reference tickers instead of wca_main
-- Add new column if it doesn't exist
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name='wca_history' AND column_name='symbol') THEN
        ALTER TABLE wca_history ADD COLUMN symbol TEXT;
    END IF;
END $$;

-- Populate symbol from wca_uid
UPDATE wca_history
SET symbol = REPLACE(wca_uid, 'wca_', '')
WHERE symbol IS NULL;

-- Step 6: Update wca_chart_5y to reference tickers
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name='wca_chart_5y' AND column_name='symbol') THEN
        ALTER TABLE wca_chart_5y ADD COLUMN symbol TEXT;
    END IF;
END $$;

-- Populate symbol from wca_uid
UPDATE wca_chart_5y
SET symbol = REPLACE(wca_uid, 'wca_', '')
WHERE symbol IS NULL;

-- Step 7: Update wca_alerts to be user-specific
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name='wca_alerts' AND column_name='user_id') THEN
        ALTER TABLE wca_alerts ADD COLUMN user_id TEXT REFERENCES users(id) ON DELETE CASCADE;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name='wca_alerts' AND column_name='symbol') THEN
        ALTER TABLE wca_alerts ADD COLUMN symbol TEXT;
    END IF;
END $$;

-- Populate user_id and symbol for existing alerts
UPDATE wca_alerts
SET user_id = 'test-user-1',
    symbol = REPLACE(wca_uid, 'wca_', '')
WHERE user_id IS NULL;

-- Note: wca_main table is kept for backward compatibility during transition
-- It can be dropped after verifying the new structure works correctly
