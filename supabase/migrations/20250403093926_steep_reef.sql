/*
  # Fix CORS issues and connection errors
  
  1. Problem:
    - Frontend is experiencing "Failed to fetch" errors connecting to Supabase
    - Browser console shows CORS issues and permission failures
  
  2. Changes:
    - Update RLS policies on all critical tables to ensure proper access
    - Create safer fallback policies for client-side queries
    - Add more lenient read policies for authenticated users on key tables
  
  3. Security:
    - Maintain core security principles while allowing necessary frontend operations
    - Ensure all tables have appropriate policies with correct user constraints
*/

-- Adjust RLS policies for voiceflow_api_keys table
ALTER TABLE voiceflow_api_keys ENABLE ROW LEVEL SECURITY;

-- Drop existing policies for voiceflow_api_keys if they exist
DROP POLICY IF EXISTS "Users can view their own API keys" ON voiceflow_api_keys;
DROP POLICY IF EXISTS "Users can insert their own API keys" ON voiceflow_api_keys;
DROP POLICY IF EXISTS "Users can update their own API keys" ON voiceflow_api_keys;
DROP POLICY IF EXISTS "Users can delete their own API keys" ON voiceflow_api_keys;
DROP POLICY IF EXISTS "Only admins can view all API keys" ON voiceflow_api_keys;
DROP POLICY IF EXISTS "Only admins can insert API keys for any user" ON voiceflow_api_keys;
DROP POLICY IF EXISTS "Only admins can update any API keys" ON voiceflow_api_keys;
DROP POLICY IF EXISTS "Only admins can delete any API keys" ON voiceflow_api_keys;

-- Create new, safer policies
CREATE POLICY "Users can view their own API keys"
  ON voiceflow_api_keys
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own API keys"
  ON voiceflow_api_keys
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own API keys"
  ON voiceflow_api_keys
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own API keys"
  ON voiceflow_api_keys
  FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- Create index on user_id for better query performance
CREATE INDEX IF NOT EXISTS idx_voiceflow_api_keys_user_id 
  ON voiceflow_api_keys(user_id);

-- Update users table policy to allow public viewing (safer for browser queries)
DROP POLICY IF EXISTS "Public users can view their own data" ON users;
CREATE POLICY "Public users can view their own data"
  ON users
  FOR SELECT
  TO public
  USING (auth.uid() = id);

-- Allow anon key SELECT access to voiceflow_mappings
DROP POLICY IF EXISTS "Authenticated users can read their voiceflow mappings" ON voiceflow_mappings;
CREATE POLICY "Authenticated users can read their voiceflow mappings"
  ON voiceflow_mappings
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id OR is_admin() = true);

-- Create access policy for webhook_configs 
DROP POLICY IF EXISTS "Public read access to own webhook configs" ON webhook_configs;
CREATE POLICY "Public read access to own webhook configs"
  ON webhook_configs
  FOR SELECT
  TO public
  USING (auth.uid() = user_id OR is_admin() = true);

-- Ensure all critical tables have appropriate indexes
CREATE INDEX IF NOT EXISTS idx_voiceflow_mappings_user_id
  ON voiceflow_mappings(user_id);

CREATE INDEX IF NOT EXISTS idx_webhook_configs_user_id
  ON webhook_configs(user_id);

CREATE INDEX IF NOT EXISTS idx_social_connections_user_id
  ON social_connections(user_id);