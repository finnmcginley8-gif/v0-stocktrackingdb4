-- Migration v7: Add projection settings to users table
-- This allows each user to store their CAGR and monthly contribution preferences

ALTER TABLE users 
ADD COLUMN IF NOT EXISTS projection_cagr NUMERIC DEFAULT 8.0,
ADD COLUMN IF NOT EXISTS projection_monthly_contribution NUMERIC DEFAULT 0;

-- Update existing test user with default values
UPDATE users 
SET projection_cagr = 8.0,
    projection_monthly_contribution = 0
WHERE projection_cagr IS NULL;

-- Add comment for documentation
COMMENT ON COLUMN users.projection_cagr IS 'Expected annual return rate (%) for 5-year projection';
COMMENT ON COLUMN users.projection_monthly_contribution IS 'Monthly contribution amount ($) for 5-year projection';
