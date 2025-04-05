/*
  # Fix Voiceflow Schema and Clean Up Database
  
  1. Problem:
    - Duplicate schema definitions for voiceflow_api_keys
    - Inconsistencies between API calls and database schema
  
  2. Fixes:
    - Ensure voiceflow_api_keys table exists with proper structure
    - Clean up any duplicate entries
    - Ensure all foreign keys and constraints are correct
    - Add proper indexes for performance
  
  3. Security:
    - Verify RLS policies are correct and consistent
*/

-- Create voiceflow_api_keys table if it doesn't exist
CREATE TABLE IF NOT EXISTS voiceflow_api_keys (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users NOT NULL,
  api_key text NOT NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create index on user_id if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes 
    WHERE tablename = 'voiceflow_api_keys' AND indexname = 'idx_voiceflow_api_keys_user_id'
  ) THEN
    CREATE INDEX idx_voiceflow_api_keys_user_id ON voiceflow_api_keys(user_id);
  END IF;
END $$;

-- Clean up any duplicate entries
-- Keep only the most recently updated record for each user_id
WITH duplicate_keys AS (
  SELECT 
    id,
    user_id,
    ROW_NUMBER() OVER (PARTITION BY user_id ORDER BY updated_at DESC) as row_num
  FROM voiceflow_api_keys
)
DELETE FROM voiceflow_api_keys
WHERE id IN (
  SELECT id FROM duplicate_keys WHERE row_num > 1
);

-- Make sure RLS is enabled
ALTER TABLE voiceflow_api_keys ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Only admins can view voiceflow API keys" ON voiceflow_api_keys;
DROP POLICY IF EXISTS "Only admins can insert voiceflow API keys" ON voiceflow_api_keys;
DROP POLICY IF EXISTS "Only admins can update voiceflow API keys" ON voiceflow_api_keys;
DROP POLICY IF EXISTS "Only admins can delete voiceflow API keys" ON voiceflow_api_keys;

-- Recreate policies
CREATE POLICY "Only admins can view voiceflow API keys"
  ON voiceflow_api_keys
  FOR SELECT
  TO authenticated
  USING (is_admin() = true);

CREATE POLICY "Only admins can insert voiceflow API keys"
  ON voiceflow_api_keys
  FOR INSERT
  TO authenticated
  WITH CHECK (is_admin() = true);

CREATE POLICY "Only admins can update voiceflow API keys"
  ON voiceflow_api_keys
  FOR UPDATE
  TO authenticated
  USING (is_admin() = true);

CREATE POLICY "Only admins can delete voiceflow API keys"
  ON voiceflow_api_keys
  FOR DELETE
  TO authenticated
  USING (is_admin() = true);

-- Check for required columns in voiceflow_mappings and add if missing
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'voiceflow_mappings') THEN
    -- Check and add user_id if it doesn't exist
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns 
      WHERE table_name = 'voiceflow_mappings' AND column_name = 'user_id'
    ) THEN
      ALTER TABLE voiceflow_mappings ADD COLUMN user_id uuid REFERENCES auth.users NOT NULL;
    END IF;
    
    -- Check and add vf_project_id if it doesn't exist
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns 
      WHERE table_name = 'voiceflow_mappings' AND column_name = 'vf_project_id'
    ) THEN
      ALTER TABLE voiceflow_mappings ADD COLUMN vf_project_id text NOT NULL;
    END IF;
    
    -- Check and add flowbridge_config if it doesn't exist
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns 
      WHERE table_name = 'voiceflow_mappings' AND column_name = 'flowbridge_config'
    ) THEN
      ALTER TABLE voiceflow_mappings ADD COLUMN flowbridge_config jsonb DEFAULT '{}'::jsonb;
    END IF;
    
    -- Check and add created_at if it doesn't exist
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns 
      WHERE table_name = 'voiceflow_mappings' AND column_name = 'created_at'
    ) THEN
      ALTER TABLE voiceflow_mappings ADD COLUMN created_at timestamptz DEFAULT now();
    END IF;
  END IF;
END $$;

-- Ensure we have the proper index on user_id for voiceflow_mappings
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'voiceflow_mappings') THEN
    IF NOT EXISTS (
      SELECT 1 FROM pg_indexes 
      WHERE tablename = 'voiceflow_mappings' AND indexname = 'idx_voiceflow_mappings_user_id'
    ) THEN
      CREATE INDEX idx_voiceflow_mappings_user_id ON voiceflow_mappings(user_id);
    END IF;
  END IF;
END $$;

-- Clean up any duplicate entries in voiceflow_mappings
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'voiceflow_mappings') THEN
    WITH duplicate_mappings AS (
      SELECT 
        id,
        user_id,
        ROW_NUMBER() OVER (PARTITION BY user_id ORDER BY created_at DESC) as row_num
      FROM voiceflow_mappings
    )
    DELETE FROM voiceflow_mappings
    WHERE id IN (
      SELECT id FROM duplicate_mappings WHERE row_num > 1
    );
  END IF;
END $$;

-- Make sure RLS is enabled for voiceflow_mappings
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'voiceflow_mappings') THEN
    ALTER TABLE voiceflow_mappings ENABLE ROW LEVEL SECURITY;
  END IF;
END $$;

-- Drop existing policies for voiceflow_mappings
DROP POLICY IF EXISTS "Users can view their own voiceflow mappings" ON voiceflow_mappings;
DROP POLICY IF EXISTS "Users can create their own voiceflow mappings" ON voiceflow_mappings;
DROP POLICY IF EXISTS "Users can update their own voiceflow mappings" ON voiceflow_mappings;
DROP POLICY IF EXISTS "Users can delete their own voiceflow mappings" ON voiceflow_mappings;
DROP POLICY IF EXISTS "Admins can view all voiceflow mappings" ON voiceflow_mappings;
DROP POLICY IF EXISTS "Admins can update all voiceflow mappings" ON voiceflow_mappings;
DROP POLICY IF EXISTS "Admins can create voiceflow mappings for any user" ON voiceflow_mappings;

-- Recreate the policies for voiceflow_mappings
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'voiceflow_mappings') THEN
    CREATE POLICY "Users can view their own voiceflow mappings"
      ON voiceflow_mappings
      FOR SELECT
      TO authenticated
      USING (auth.uid() = user_id);
    
    CREATE POLICY "Users can create their own voiceflow mappings"
      ON voiceflow_mappings
      FOR INSERT
      TO authenticated
      WITH CHECK (auth.uid() = user_id);
    
    CREATE POLICY "Users can update their own voiceflow mappings"
      ON voiceflow_mappings
      FOR UPDATE
      TO authenticated
      USING (auth.uid() = user_id);
    
    CREATE POLICY "Users can delete their own voiceflow mappings"
      ON voiceflow_mappings
      FOR DELETE
      TO authenticated
      USING (auth.uid() = user_id);
    
    CREATE POLICY "Admins can view all voiceflow mappings"
      ON voiceflow_mappings
      FOR SELECT
      TO authenticated
      USING (is_admin() = true);
    
    CREATE POLICY "Admins can update all voiceflow mappings"
      ON voiceflow_mappings
      FOR UPDATE
      TO authenticated
      USING (is_admin() = true);
    
    CREATE POLICY "Admins can create voiceflow mappings for any user"
      ON voiceflow_mappings
      FOR INSERT
      TO authenticated
      WITH CHECK (is_admin() = true);
  END IF;
END $$;