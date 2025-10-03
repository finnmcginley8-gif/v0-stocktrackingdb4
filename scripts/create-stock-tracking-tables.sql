-- Stock Tracking Database Schema
-- Creates tables for WCA (Wealth Creation Assistant) stock tracking system

-- Main table: snapshot of each stock
CREATE TABLE wca_main (
    symbol TEXT NOT NULL,
    uid TEXT GENERATED ALWAYS AS ('wca_' || lower(symbol)) STORED PRIMARY KEY,
    target_price NUMERIC,
    current_quote NUMERIC,
    sma200 NUMERIC,
    delta_to_quote NUMERIC,
    delta_to_sma NUMERIC
);

-- Daily history: used for SMA/delta checks
CREATE TABLE wca_history (
    id BIGSERIAL PRIMARY KEY,
    wca_uid TEXT REFERENCES wca_main(uid) ON DELETE CASCADE,
    date DATE NOT NULL,
    current_quote NUMERIC,
    sma200 NUMERIC,
    delta_to_sma NUMERIC,
    delta_to_quote NUMERIC,
    UNIQUE (wca_uid, date)  -- no duplicate history for same day
);

-- Index for fast lookups by stock + date
CREATE INDEX idx_wca_history_uid_date ON wca_history (wca_uid, date);

-- Alerts: triggered events
CREATE TABLE wca_alerts (
    id BIGSERIAL PRIMARY KEY,
    wca_uid TEXT REFERENCES wca_main(uid) ON DELETE CASCADE,
    type TEXT NOT NULL,        -- e.g. 'delta_to_quote_cross'
    status TEXT NOT NULL,      -- e.g. 'triggered', 'cleared'
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5-year chart data: historical closes
CREATE TABLE wca_chart_5y (
    id BIGSERIAL PRIMARY KEY,
    wca_uid TEXT REFERENCES wca_main(uid) ON DELETE CASCADE,
    date DATE NOT NULL,
    close_quote NUMERIC,
    UNIQUE (wca_uid, date)  -- prevent duplicates for same day
);

-- Index for fast chart queries by stock + date
CREATE INDEX idx_wca_chart_5y_uid_date ON wca_chart_5y (wca_uid, date);

-- Insert some sample data for testing
INSERT INTO wca_main (symbol, target_price, current_quote, sma200, delta_to_quote, delta_to_sma) VALUES
('AAPL', 150.00, 145.50, 140.25, -4.50, 5.25),
('GOOGL', 2800.00, 2750.00, 2700.00, -50.00, 50.00),
('MSFT', 350.00, 345.00, 340.00, -5.00, 5.00);

-- Insert sample history data
INSERT INTO wca_history (wca_uid, date, current_quote, sma200, delta_to_sma, delta_to_quote) VALUES
('wca_aapl', CURRENT_DATE - INTERVAL '1 day', 144.00, 139.50, 4.50, -6.00),
('wca_aapl', CURRENT_DATE, 145.50, 140.25, 5.25, -4.50),
('wca_googl', CURRENT_DATE - INTERVAL '1 day', 2720.00, 2680.00, 40.00, -80.00),
('wca_googl', CURRENT_DATE, 2750.00, 2700.00, 50.00, -50.00);

-- Insert sample chart data
INSERT INTO wca_chart_5y (wca_uid, date, close_quote) VALUES
('wca_aapl', CURRENT_DATE - INTERVAL '30 days', 142.00),
('wca_aapl', CURRENT_DATE - INTERVAL '15 days', 144.50),
('wca_aapl', CURRENT_DATE, 145.50),
('wca_googl', CURRENT_DATE - INTERVAL '30 days', 2680.00),
('wca_googl', CURRENT_DATE - INTERVAL '15 days', 2720.00),
('wca_googl', CURRENT_DATE, 2750.00);
