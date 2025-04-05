/*
  # Add User Context and Session Management
  
  1. New Tables
    - `user_sessions`
      - `id` (uuid, primary key)
      - `user_id` (uuid, references auth.users)
      - `participant_id` (text)
      - `platform` (text)
      - `context` (jsonb)
      - `last_interaction` (timestamp)
      - `created_at` (timestamp)
      - `expires_at` (timestamp)
  
  2. Modifications
    - Add `session_id` column to conversations table
  
  3. Security
    - Enable RLS on new table
    - Add policies for authenticated users and admins
*/

-- Create user_sessions table
CREATE TABLE IF NOT EXISTS user_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users NOT NULL,
  participant_id text NOT NULL,
  platform text NOT NULL CHECK (platform IN ('facebook', 'instagram')),
  context jsonb DEFAULT '{}'::jsonb,
  last_interaction timestamptz DEFAULT now(),
  created_at timestamptz DEFAULT now(),
  expires_at timestamptz DEFAULT (now() + interval '24 hours')
);

-- Add session_id to conversations table if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'conversations' AND column_name = 'session_id'
  ) THEN
    ALTER TABLE conversations
    ADD COLUMN session_id uuid REFERENCES user_sessions(id);
  END IF;
END $$;

-- Enable Row Level Security
ALTER TABLE user_sessions ENABLE ROW LEVEL SECURITY;

-- Create policies for user_sessions
CREATE POLICY "Users can view their own sessions"
  ON user_sessions
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own sessions"
  ON user_sessions
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own sessions"
  ON user_sessions
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all sessions"
  ON user_sessions
  FOR SELECT
  TO authenticated
  USING (is_admin() = true);

-- Create indexes for faster querying
CREATE INDEX IF NOT EXISTS idx_user_sessions_user_id 
  ON user_sessions(user_id);

CREATE INDEX IF NOT EXISTS idx_user_sessions_participant_platform 
  ON user_sessions(user_id, participant_id, platform);

CREATE INDEX IF NOT EXISTS idx_user_sessions_last_interaction 
  ON user_sessions(last_interaction);