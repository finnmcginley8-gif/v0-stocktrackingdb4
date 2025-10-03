-- Drop the old portfolio_transactions table and recreate with correct Google Sheet columns
DROP TABLE IF EXISTS portfolio_transactions CASCADE;

-- Create portfolio_transactions table matching Google Sheet structure
CREATE TABLE portfolio_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
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

-- Create index for faster queries
CREATE INDEX idx_portfolio_transactions_user_id ON portfolio_transactions(user_id);
CREATE INDEX idx_portfolio_transactions_ticker ON portfolio_transactions(ticker);
CREATE INDEX idx_portfolio_transactions_user_ticker ON portfolio_transactions(user_id, ticker);

-- Enable RLS
ALTER TABLE portfolio_transactions ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view their own portfolio transactions"
  ON portfolio_transactions FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own portfolio transactions"
  ON portfolio_transactions FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own portfolio transactions"
  ON portfolio_transactions FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own portfolio transactions"
  ON portfolio_transactions FOR DELETE
  USING (auth.uid() = user_id);
