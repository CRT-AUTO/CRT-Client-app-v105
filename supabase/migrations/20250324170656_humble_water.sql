/*
  # Add Message Queue System and Processing Status Tracking
  
  1. New Tables
    - `message_queue`
      - `id` (uuid, primary key)
      - `user_id` (uuid, references auth.users)
      - `platform` (text, 'facebook' or 'instagram')
      - `sender_id` (text)
      - `recipient_id` (text)
      - `message_content` (jsonb)
      - `timestamp` (timestamp)
      - `status` (text) - 'pending', 'processing', 'completed', 'failed'
      - `error` (text)
      - `retry_count` (integer)
      - `last_retry_at` (timestamp)
      - `created_at` (timestamp)
      - `completed_at` (timestamp)
    
    - `message_processing_status`
      - `id` (uuid, primary key)
      - `message_queue_id` (uuid, references message_queue)
      - `stage` (text) - 'received', 'parsed', 'conversation_found', 'voiceflow_processed', 'response_sent'
      - `status` (text) - 'pending', 'completed', 'failed'
      - `error` (text)
      - `metadata` (jsonb)
      - `created_at` (timestamp)
      - `updated_at` (timestamp)
  
  2. Security
    - Enable RLS on new tables
    - Add policies for authenticated users and admins
*/

-- Create message_queue table
CREATE TABLE IF NOT EXISTS message_queue (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users NOT NULL,
  platform text NOT NULL CHECK (platform IN ('facebook', 'instagram')),
  sender_id text NOT NULL,
  recipient_id text NOT NULL,
  message_content jsonb NOT NULL,
  timestamp timestamptz NOT NULL,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
  error text,
  retry_count integer DEFAULT 0,
  last_retry_at timestamptz,
  created_at timestamptz DEFAULT now(),
  completed_at timestamptz
);

-- Create message_processing_status table
CREATE TABLE IF NOT EXISTS message_processing_status (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  message_queue_id uuid REFERENCES message_queue NOT NULL,
  stage text NOT NULL,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'completed', 'failed')),
  error text,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE message_queue ENABLE ROW LEVEL SECURITY;
ALTER TABLE message_processing_status ENABLE ROW LEVEL SECURITY;

-- Create policies for message_queue
CREATE POLICY "Users can view their own message queue"
  ON message_queue
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all message queue items"
  ON message_queue
  FOR SELECT
  TO authenticated
  USING (is_admin() = true);

CREATE POLICY "Users and admins can insert message queue items"
  ON message_queue
  FOR INSERT
  TO authenticated
  WITH CHECK ((auth.uid() = user_id) OR (is_admin() = true));

CREATE POLICY "Users and admins can update their own message queue items"
  ON message_queue
  FOR UPDATE
  TO authenticated
  USING ((auth.uid() = user_id) OR (is_admin() = true));

-- Create policies for message_processing_status
CREATE POLICY "Users can view their own message processing status"
  ON message_processing_status
  FOR SELECT
  TO authenticated
  USING (EXISTS (
    SELECT 1 FROM message_queue
    WHERE message_queue.id = message_processing_status.message_queue_id
    AND message_queue.user_id = auth.uid()
  ));

CREATE POLICY "Admins can view all message processing status"
  ON message_processing_status
  FOR SELECT
  TO authenticated
  USING (is_admin() = true);

CREATE POLICY "Users and admins can insert message processing status"
  ON message_processing_status
  FOR INSERT
  TO authenticated
  WITH CHECK (EXISTS (
    SELECT 1 FROM message_queue
    WHERE message_queue.id = message_processing_status.message_queue_id
    AND (message_queue.user_id = auth.uid() OR is_admin() = true)
  ));

CREATE POLICY "Users and admins can update message processing status"
  ON message_processing_status
  FOR UPDATE
  TO authenticated
  USING (EXISTS (
    SELECT 1 FROM message_queue
    WHERE message_queue.id = message_processing_status.message_queue_id
    AND (message_queue.user_id = auth.uid() OR is_admin() = true)
  ));

-- Create indexes for faster querying
CREATE INDEX IF NOT EXISTS idx_message_queue_user_id_status 
  ON message_queue(user_id, status);

CREATE INDEX IF NOT EXISTS idx_message_queue_status_created_at 
  ON message_queue(status, created_at);

CREATE INDEX IF NOT EXISTS idx_message_processing_status_message_queue_id 
  ON message_processing_status(message_queue_id);