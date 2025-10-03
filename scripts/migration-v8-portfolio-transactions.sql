-- Migration v8: Add portfolio_transactions table for portfolio tracking
-- Store raw transaction data from Google Sheet instead of net positions

CREATE TABLE IF NOT EXISTS portfolio_transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    trade_date DATE NOT NULL,
    transaction_type TEXT NOT NULL, -- 'Buy' or 'Sell'
    ticker TEXT NOT NULL,
    quantity NUMERIC NOT NULL,
    local_price NUMERIC NOT NULL,
    trade_currency TEXT NOT NULL,
    include_in_portfolio BOOLEAN NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for fast lookups by user
CREATE INDEX IF NOT EXISTS idx_portfolio_transactions_user_id ON portfolio_transactions (user_id);
CREATE INDEX IF NOT EXISTS idx_portfolio_transactions_ticker ON portfolio_transactions (ticker);
CREATE INDEX IF NOT EXISTS idx_portfolio_transactions_user_ticker ON portfolio_transactions (user_id, ticker);

-- Add portfolio_sheet_url to users table for storing Google Sheet URL
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name='users' AND column_name='portfolio_sheet_url') THEN
        ALTER TABLE users ADD COLUMN portfolio_sheet_url TEXT;
    END IF;
END $$;
