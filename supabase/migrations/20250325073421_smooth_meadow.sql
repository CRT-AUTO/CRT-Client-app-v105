/*
  # Fix Webhook Configuration Policies
  
  1. Changes
    - Add policies allowing users to manage their own webhook configs
    - Maintain admin privileges for managing all webhook configs
  
  2. Security
    - Maintain RLS for webhook_configs table
    - Allow users to create, view, and update their own webhook configurations
*/

-- Drop existing policies for webhook_configs
DROP POLICY IF EXISTS "Users can view their own webhook configs" ON webhook_configs;
DROP POLICY IF EXISTS "Only admins can insert webhook configs" ON webhook_configs;
DROP POLICY IF EXISTS "Only admins can update webhook configs" ON webhook_configs;

-- Create more comprehensive policies for webhook_configs

-- Admin policies
CREATE POLICY "Admins can view all webhook configs"
  ON webhook_configs
  FOR SELECT
  TO public
  USING (is_admin() = true);

CREATE POLICY "Admins can insert webhook configs for any user"
  ON webhook_configs
  FOR INSERT
  TO public
  WITH CHECK (is_admin() = true);

CREATE POLICY "Admins can update webhook configs"
  ON webhook_configs
  FOR UPDATE
  TO public
  USING (is_admin() = true);

-- User self-service policies
CREATE POLICY "Users can view their own webhook configs"
  ON webhook_configs
  FOR SELECT
  TO public
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own webhook configs"
  ON webhook_configs
  FOR INSERT
  TO public
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own webhook configs"
  ON webhook_configs
  FOR UPDATE
  TO public
  USING (auth.uid() = user_id);

-- Also check and fix the limit(1) issue in webhook_configs related functions
DO $$
BEGIN
  -- Create index on user_id if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes 
    WHERE tablename = 'webhook_configs' AND indexname = 'idx_webhook_configs_user_id'
  ) THEN
    CREATE INDEX idx_webhook_configs_user_id ON webhook_configs(user_id);
  END IF;

  -- Clean up any duplicate webhook configs
  WITH duplicate_configs AS (
    SELECT 
      id,
      user_id,
      platform,
      ROW_NUMBER() OVER (PARTITION BY user_id, platform ORDER BY updated_at DESC) as row_num
    FROM webhook_configs
  )
  DELETE FROM webhook_configs
  WHERE id IN (
    SELECT id FROM duplicate_configs WHERE row_num > 1
  );
END $$;