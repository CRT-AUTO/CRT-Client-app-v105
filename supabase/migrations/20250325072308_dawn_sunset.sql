/*
  # Update Voiceflow API Key RLS Policies
  
  1. Problem:
    - Current policy only allows admins to insert API keys
    - Users need to be able to manage their own API keys
  
  2. Changes:
    - Add new RLS policy to allow users to insert their own API keys
    - Keep existing admin policies
    - Modify update policy to allow users to update their own keys
*/

-- Drop and recreate the policies for voiceflow_api_keys
DROP POLICY IF EXISTS "Only admins can view voiceflow API keys" ON voiceflow_api_keys;
DROP POLICY IF EXISTS "Only admins can insert voiceflow API keys" ON voiceflow_api_keys;
DROP POLICY IF EXISTS "Only admins can update voiceflow API keys" ON voiceflow_api_keys;
DROP POLICY IF EXISTS "Only admins can delete voiceflow API keys" ON voiceflow_api_keys;
DROP POLICY IF EXISTS "Users can insert their own API keys" ON voiceflow_api_keys;
DROP POLICY IF EXISTS "Users can update their own API keys" ON voiceflow_api_keys;
DROP POLICY IF EXISTS "Users can view their own API keys" ON voiceflow_api_keys;

-- Admin policies
CREATE POLICY "Only admins can view all API keys"
  ON voiceflow_api_keys
  FOR SELECT
  TO authenticated
  USING (is_admin() = true);

CREATE POLICY "Only admins can insert API keys for any user"
  ON voiceflow_api_keys
  FOR INSERT
  TO authenticated
  WITH CHECK (is_admin() = true);

CREATE POLICY "Only admins can update any API keys"
  ON voiceflow_api_keys
  FOR UPDATE
  TO authenticated
  USING (is_admin() = true);

CREATE POLICY "Only admins can delete any API keys"
  ON voiceflow_api_keys
  FOR DELETE
  TO authenticated
  USING (is_admin() = true);

-- User self-service policies
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