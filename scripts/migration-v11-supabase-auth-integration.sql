-- Migration v11: Set up Supabase Auth integration
-- This migration updates the users table to work with Supabase Auth

-- Update users table to use auth.users id
ALTER TABLE users 
  ADD COLUMN IF NOT EXISTS auth_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_users_auth_id ON users(auth_id);

-- For development/testing: ensure test-user-1 exists
INSERT INTO users (id, email) 
VALUES ('test-user-1', 'test@example.com')
ON CONFLICT (id) DO NOTHING;

-- Function to automatically create user record when someone signs up
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.users (id, email, auth_id, created_at, updated_at)
  VALUES (
    'user_' || NEW.id::text,
    NEW.email,
    NEW.id,
    NOW(),
    NOW()
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
EXCEPTION
  WHEN OTHERS THEN
    -- Log error but don't fail the auth signup
    RAISE WARNING 'Failed to create user record: %', SQLERRM;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant necessary permissions
GRANT USAGE ON SCHEMA public TO postgres, anon, authenticated, service_role;
GRANT ALL ON ALL TABLES IN SCHEMA public TO postgres, anon, authenticated, service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO postgres, anon, authenticated, service_role;

-- Trigger to create user record on auth.users insert
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Update RLS policies for multi-user access
-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Users can view their own watchlist" ON user_watchlist;
DROP POLICY IF EXISTS "Users can insert to their own watchlist" ON user_watchlist;
DROP POLICY IF EXISTS "Users can update their own watchlist" ON user_watchlist;
DROP POLICY IF EXISTS "Users can delete from their own watchlist" ON user_watchlist;

-- Enable RLS on user_watchlist
ALTER TABLE user_watchlist ENABLE ROW LEVEL SECURITY;

-- Create policies that work in both dev (test-user-1) and prod (auth.uid())
CREATE POLICY "Users can view their own watchlist" ON user_watchlist
  FOR SELECT
  USING (
    user_id = 'test-user-1' -- Dev/preview bypass
    OR 
    user_id = 'user_' || auth.uid()::text -- Production with auth
  );

CREATE POLICY "Users can insert to their own watchlist" ON user_watchlist
  FOR INSERT
  WITH CHECK (
    user_id = 'test-user-1' -- Dev/preview bypass
    OR 
    user_id = 'user_' || auth.uid()::text -- Production with auth
  );

CREATE POLICY "Users can update their own watchlist" ON user_watchlist
  FOR UPDATE
  USING (
    user_id = 'test-user-1' -- Dev/preview bypass
    OR 
    user_id = 'user_' || auth.uid()::text -- Production with auth
  );

CREATE POLICY "Users can delete from their own watchlist" ON user_watchlist
  FOR DELETE
  USING (
    user_id = 'test-user-1' -- Dev/preview bypass
    OR 
    user_id = 'user_' || auth.uid()::text -- Production with auth
  );

-- Similar policies for portfolio_transactions
DROP POLICY IF EXISTS "Users can view their own portfolio transactions" ON portfolio_transactions;
DROP POLICY IF EXISTS "Users can insert their own portfolio transactions" ON portfolio_transactions;
DROP POLICY IF EXISTS "Users can update their own portfolio transactions" ON portfolio_transactions;
DROP POLICY IF EXISTS "Users can delete their own portfolio transactions" ON portfolio_transactions;

ALTER TABLE portfolio_transactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own portfolio transactions" ON portfolio_transactions
  FOR SELECT
  USING (
    user_id = 'test-user-1'
    OR 
    user_id = 'user_' || auth.uid()::text
  );

CREATE POLICY "Users can insert their own portfolio transactions" ON portfolio_transactions
  FOR INSERT
  WITH CHECK (
    user_id = 'test-user-1'
    OR 
    user_id = 'user_' || auth.uid()::text
  );

CREATE POLICY "Users can update their own portfolio transactions" ON portfolio_transactions
  FOR UPDATE
  USING (
    user_id = 'test-user-1'
    OR 
    user_id = 'user_' || auth.uid()::text
  );

CREATE POLICY "Users can delete their own portfolio transactions" ON portfolio_transactions
  FOR DELETE
  USING (
    user_id = 'test-user-1'
    OR 
    user_id = 'user_' || auth.uid()::text
  );

-- Comment for documentation
COMMENT ON COLUMN users.auth_id IS 'Links to auth.users(id) for authenticated users. NULL for test users.';
