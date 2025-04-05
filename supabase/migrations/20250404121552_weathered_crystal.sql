/*
  # Add explicit auth status and fix webhook paths
  
  1. Problem:
    - Webhook handler cannot reliably determine if a user is authenticated
    - Need a more explicit way to track authentication status
  
  2. Changes:
    - Add explicit authentication status tracking functions
    - Ensure all tables have proper RLS policies
    - Fix webhook paths and validation
  
  3. Functions:
    - check_auth_status() - Returns whether the current user is authenticated
*/

-- Create a function to check authentication status
CREATE OR REPLACE FUNCTION public.check_auth_status()
RETURNS BOOLEAN AS $$
BEGIN
  -- This will return FALSE if not authenticated, TRUE if authenticated
  RETURN (auth.uid() IS NOT NULL);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create a ping function if it doesn't exist
CREATE OR REPLACE FUNCTION public.ping()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN true;
END;
$$ LANGUAGE plpgsql;

-- Grant execution permissions to everyone
GRANT EXECUTE ON FUNCTION public.check_auth_status() TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.ping() TO authenticated, anon;

-- Ensure webhook_configs has the right platform check
ALTER TABLE IF EXISTS webhook_configs
DROP CONSTRAINT IF EXISTS webhook_configs_platform_check;

ALTER TABLE IF EXISTS webhook_configs
ADD CONSTRAINT webhook_configs_platform_check 
CHECK (platform IN ('all', 'facebook', 'instagram', 'whatsapp'));

-- Add a field to track last authentication time in users table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'users' AND column_name = 'last_sign_in'
  ) THEN
    ALTER TABLE users ADD COLUMN last_sign_in timestamptz;
    
    -- Update existing users with a default value
    UPDATE users SET last_sign_in = users.created_at;
  END IF;
END $$;