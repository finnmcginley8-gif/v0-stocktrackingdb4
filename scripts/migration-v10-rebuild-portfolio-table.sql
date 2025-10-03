-- Drop the old portfolio_transactions table and rebuild with correct Google Sheet columns
DROP TABLE IF EXISTS portfolio_transactions CASCADE;

-- Create portfolio_transactions table matching Google Sheet structure
CREATE TABLE portfolio_transactions (
  id BIGSERIAL PRIMARY KEY,
  user_id TEXT REFERENCES users(id) ON DELETE CASCADE,
  trade_date DATE NOT NULL,
  transaction_type TEXT NOT NULL, -- 'Buy' or 'Sell'
  ticker TEXT NOT NULL,
  quantity NUMERIC NOT NULL,
  local_price NUMERIC NOT NULL,
  trade_currency TEXT NOT NULL,
  include_in_portfolio BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create index for faster queries
CREATE INDEX idx_portfolio_user_ticker ON portfolio_transactions(user_id, ticker);
CREATE INDEX idx_portfolio_include ON portfolio_transactions(user_id, include_in_portfolio);
