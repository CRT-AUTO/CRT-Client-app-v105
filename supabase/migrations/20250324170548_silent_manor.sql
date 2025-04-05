/*
  # Add Message Dead Letter Queue and Error Recovery
  
  1. New Tables
    - `message_dead_letters`
      - `id` (uuid, primary key)
      - `user_id` (uuid, references auth.users)
      - `message_content` (text)
      - `error_message` (text)
      - `metadata` (jsonb)
      - `failed_at` (timestamp)
      - `retry_count` (integer)
      - `last_retry_at` (timestamp)
      - `status` (text) - 'failed', 'retrying', 'resolved'
  
  2. Security
    - Enable RLS on new table
    - Add policies for authenticated users and admins
*/

-- Create message_dead_letters table for failed message handling
CREATE TABLE IF NOT EXISTS message_dead_letters (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users NOT NULL,
  message_content text NOT NULL,
  error_message text,
  metadata jsonb DEFAULT '{}'::jsonb,
  failed_at timestamptz DEFAULT now(),
  retry_count integer DEFAULT 0,
  last_retry_at timestamptz,
  status text DEFAULT 'failed' CHECK (status IN ('failed', 'retrying', 'resolved')),
  created_at timestamptz DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE message_dead_letters ENABLE ROW LEVEL SECURITY;

-- Create policies for message_dead_letters
CREATE POLICY "Users can view their own dead letter messages"
  ON message_dead_letters
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all dead letter messages"
  ON message_dead_letters
  FOR SELECT
  TO authenticated
  USING (is_admin() = true);

CREATE POLICY "Admins can update dead letter messages"
  ON message_dead_letters
  FOR UPDATE
  TO authenticated
  USING (is_admin() = true);

CREATE POLICY "Admins can insert dead letter messages"
  ON message_dead_letters
  FOR INSERT
  TO authenticated
  WITH CHECK (is_admin() = true);

-- Create index for faster querying
CREATE INDEX IF NOT EXISTS idx_message_dead_letters_user_id
  ON message_dead_letters(user_id);

CREATE INDEX IF NOT EXISTS idx_message_dead_letters_status
  ON message_dead_letters(status);