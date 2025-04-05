/*
  # Fix Public Access Permissions
  
  1. Changes
    - Add policies allowing public access to tables for authenticated users
    - Fix permission denied errors for browser access
    - Enable proper access to social_connections, voiceflow_mappings, conversations, and messages
  
  2. Security
    - Maintain RLS protection while allowing necessary operations
    - Ensure users can only access their own data
*/

-- Allow public access to social_connections for currently authenticated users
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'social_connections' AND policyname = 'Public can view their own social connections'
  ) THEN
    CREATE POLICY "Public can view their own social connections"
      ON social_connections
      FOR SELECT
      TO public  -- This includes the anon key
      USING (auth.uid() = user_id);
  END IF;
END $$;

-- Allow public access to voiceflow_mappings for the currently authenticated users
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'voiceflow_mappings' AND policyname = 'Public can view their own voiceflow mappings'
  ) THEN
    CREATE POLICY "Public can view their own voiceflow mappings"
      ON voiceflow_mappings
      FOR SELECT
      TO public
      USING (auth.uid() = user_id);
  END IF;
END $$;

-- Allow public access to conversations
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'conversations' AND policyname = 'Public can view their own conversations'
  ) THEN
    CREATE POLICY "Public can view their own conversations"
      ON conversations
      FOR SELECT
      TO public
      USING (auth.uid() = user_id);
  END IF;
END $$;

-- Allow public access to messages (where the conversation is owned by the user)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'messages' AND policyname = 'Public can view messages for their own conversations'
  ) THEN
    CREATE POLICY "Public can view messages for their own conversations"
      ON messages
      FOR SELECT
      TO public
      USING (EXISTS (
        SELECT 1 FROM conversations
        WHERE conversations.id = conversation_id
        AND conversations.user_id = auth.uid()
      ));
  END IF;
END $$;

-- Fix users table access for public users
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'users' AND policyname = 'Public users can view their own data'
  ) THEN
    CREATE POLICY "Public users can view their own data"
      ON users
      FOR SELECT
      TO public
      USING (auth.uid() = id);
  END IF;
END $$;

-- Ensure all critical tables have appropriate indexes
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes 
    WHERE indexname = 'idx_voiceflow_mappings_user_id'
  ) THEN
    CREATE INDEX idx_voiceflow_mappings_user_id
      ON voiceflow_mappings(user_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes 
    WHERE indexname = 'idx_webhook_configs_user_id'
  ) THEN
    CREATE INDEX idx_webhook_configs_user_id
      ON webhook_configs(user_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes 
    WHERE indexname = 'idx_social_connections_user_id'
  ) THEN
    CREATE INDEX idx_social_connections_user_id
      ON social_connections(user_id);
  END IF;
END $$;