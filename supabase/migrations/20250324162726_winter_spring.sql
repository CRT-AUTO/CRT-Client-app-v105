/*
  # Add Voiceflow API Keys and Webhook Improvements
  
  1. New Tables
    - `voiceflow_api_keys`
      - `id` (uuid, primary key)
      - `user_id` (uuid, references auth.users)
      - `api_key` (text, encrypted API key)
      - `created_at` (timestamp)
      - `updated_at` (timestamp)
  
  2. Modifications to webhook_configs
    - Add `platform` column to specify which platform (facebook, instagram, all)
    - Add `webhook_name` for better identification
    - Add `generated_url` to store system-generated webhook URLs
  
  3. Security
    - Enable RLS on new table
    - Only admins can manage API keys
*/

-- Create voiceflow_api_keys table
CREATE TABLE IF NOT EXISTS voiceflow_api_keys (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users NOT NULL,
  api_key text NOT NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE voiceflow_api_keys ENABLE ROW LEVEL SECURITY;

-- Create policies for voiceflow_api_keys (admin only)
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

-- Add new columns to webhook_configs
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'webhook_configs' AND column_name = 'platform'
  ) THEN
    ALTER TABLE webhook_configs
    ADD COLUMN platform text DEFAULT 'all' CHECK (platform IN ('all', 'facebook', 'instagram'));
  END IF;
  
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'webhook_configs' AND column_name = 'webhook_name'
  ) THEN
    ALTER TABLE webhook_configs
    ADD COLUMN webhook_name text;
  END IF;
  
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'webhook_configs' AND column_name = 'generated_url'
  ) THEN
    ALTER TABLE webhook_configs
    ADD COLUMN generated_url text;
  END IF;
END $$;