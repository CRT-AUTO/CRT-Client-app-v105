/*
  # Initial schema setup for AI Assistant Platform
  
  1. New Tables
    - `social_connections`
      - `id` (uuid, primary key)
      - `user_id` (uuid, references auth.users)
      - `fb_page_id` (text, optional)
      - `ig_account_id` (text, optional)
      - `access_token` (text)
      - `token_expiry` (timestamp)
      - `created_at` (timestamp)
    
    - `voiceflow_mappings`
      - `id` (uuid, primary key)
      - `user_id` (uuid, references auth.users)
      - `vf_project_id` (text)
      - `flowbridge_config` (jsonb)
      - `created_at` (timestamp)
      
  2. Security
    - Enable RLS on all tables
    - Add policies for authenticated users to read/write their own data
*/

-- Create social_connections table
CREATE TABLE IF NOT EXISTS social_connections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users NOT NULL,
  fb_page_id text,
  ig_account_id text,
  access_token text NOT NULL,
  token_expiry timestamptz NOT NULL,
  created_at timestamptz DEFAULT now(),
  
  CONSTRAINT require_one_social_account CHECK (
    (fb_page_id IS NOT NULL) OR (ig_account_id IS NOT NULL)
  )
);

-- Create voiceflow_mappings table
CREATE TABLE IF NOT EXISTS voiceflow_mappings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users NOT NULL,
  vf_project_id text NOT NULL,
  flowbridge_config jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE social_connections ENABLE ROW LEVEL SECURITY;
ALTER TABLE voiceflow_mappings ENABLE ROW LEVEL SECURITY;

-- Create policies for social_connections
CREATE POLICY "Users can view their own social connections"
  ON social_connections
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own social connections"
  ON social_connections
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own social connections"
  ON social_connections
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own social connections"
  ON social_connections
  FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- Create policies for voiceflow_mappings
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