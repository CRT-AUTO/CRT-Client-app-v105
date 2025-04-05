/*
  # Fix Social Connections Table and Add Ping Function
  
  1. Problem:
    - Facebook webhook handler is failing to find social connections
    - Connection status check is failing with "function ping() does not exist"
  
  2. Changes:
    - Add index on fb_page_id and ig_account_id for faster lookups
    - Create ping function if it doesn't exist
    - Fix any potential issues with social_connections table
  
  3. Security:
    - Maintain RLS protection while ensuring proper access
*/

-- Create ping function if it doesn't exist
CREATE OR REPLACE FUNCTION public.ping()
RETURNS boolean AS
$$
BEGIN
  RETURN true;
END;
$$ LANGUAGE plpgsql;

-- Grant execution permissions to all authenticated and anonymous users
GRANT EXECUTE ON FUNCTION public.ping() TO authenticated, anon;

-- Add indexes for faster lookups on social_connections
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes 
    WHERE indexname = 'idx_social_connections_fb_page_id'
  ) THEN
    CREATE INDEX idx_social_connections_fb_page_id ON social_connections(fb_page_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes 
    WHERE indexname = 'idx_social_connections_ig_account_id'
  ) THEN
    CREATE INDEX idx_social_connections_ig_account_id ON social_connections(ig_account_id);
  END IF;
END $$;

-- Fix any potential issues with social_connections table
DO $$
BEGIN
  -- Make sure the table exists
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_name = 'social_connections'
  ) THEN
    CREATE TABLE IF NOT EXISTS social_connections (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id uuid REFERENCES auth.users NOT NULL,
      fb_page_id text,
      ig_account_id text,
      access_token text NOT NULL,
      token_expiry timestamptz NOT NULL,
      created_at timestamptz DEFAULT now(),
      refreshed_at timestamptz,
      
      CONSTRAINT require_one_social_account CHECK (
        (fb_page_id IS NOT NULL) OR (ig_account_id IS NOT NULL)
      )
    );
  END IF;

  -- Make sure RLS is enabled
  ALTER TABLE social_connections ENABLE ROW LEVEL SECURITY;
END $$;

-- Ensure public access to social_connections for the current user
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'social_connections' AND policyname = 'Public can view their own social connections'
  ) THEN
    CREATE POLICY "Public can view their own social connections"
      ON social_connections
      FOR SELECT
      TO public
      USING (auth.uid() = user_id);
  END IF;
END $$;