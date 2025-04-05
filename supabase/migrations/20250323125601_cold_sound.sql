/*
  # Add Conversation and Message Management

  1. New Tables
    - `conversations`
      - `id` (uuid, primary key)
      - `user_id` (uuid, foreign key to users)
      - `platform` (text, either 'facebook' or 'instagram')
      - `external_id` (text, platform's conversation ID)
      - `participant_id` (text, the external user's ID)
      - `participant_name` (text, the external user's name)
      - `last_message_at` (timestamp, time of last message)
      - `created_at` (timestamp)
    - `messages`
      - `id` (uuid, primary key)
      - `conversation_id` (uuid, foreign key to conversations)
      - `content` (text, message content)
      - `sender_type` (text, 'user' or 'assistant')
      - `external_id` (text, platform's message ID)
      - `sent_at` (timestamp)
      - `created_at` (timestamp)
    - `api_rate_limits`
      - `id` (uuid, primary key)
      - `user_id` (uuid, foreign key to users)
      - `platform` (text, 'facebook', 'instagram', 'voiceflow')
      - `endpoint` (text, specific API endpoint)
      - `calls_made` (integer, count of API calls)
      - `reset_at` (timestamp, when the counter resets)
      - `created_at` (timestamp)
  
  2. Modifications
    - Add `refreshed_at` to social_connections table to track token refresh
  
  3. Security
    - Enable RLS on all new tables
    - Add policies for authenticated users to manage their data
*/

-- Create conversations table
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'conversations') THEN
    CREATE TABLE IF NOT EXISTS conversations (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id uuid NOT NULL,
      platform text NOT NULL CHECK (platform IN ('facebook', 'instagram')),
      external_id text NOT NULL,
      participant_id text NOT NULL,
      participant_name text,
      last_message_at timestamptz DEFAULT now(),
      created_at timestamptz DEFAULT now(),
      UNIQUE(user_id, platform, external_id)
    );

    ALTER TABLE conversations ADD CONSTRAINT conversations_user_id_fkey 
      FOREIGN KEY (user_id) REFERENCES auth.users(id);

    ALTER TABLE conversations ENABLE ROW LEVEL SECURITY;
  END IF;
END $$;

-- Add policies for conversations
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'conversations' AND policyname = 'Users can create their own conversations'
  ) THEN
    CREATE POLICY "Users can create their own conversations"
      ON conversations
      FOR INSERT
      TO authenticated
      WITH CHECK (auth.uid() = user_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'conversations' AND policyname = 'Users can view their own conversations'
  ) THEN
    CREATE POLICY "Users can view their own conversations"
      ON conversations
      FOR SELECT
      TO authenticated
      USING (auth.uid() = user_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'conversations' AND policyname = 'Users can update their own conversations'
  ) THEN
    CREATE POLICY "Users can update their own conversations"
      ON conversations
      FOR UPDATE
      TO authenticated
      USING (auth.uid() = user_id);
  END IF;
END $$;

-- Create messages table
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'messages') THEN
    CREATE TABLE IF NOT EXISTS messages (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      conversation_id uuid NOT NULL,
      content text NOT NULL,
      sender_type text NOT NULL CHECK (sender_type IN ('user', 'assistant')),
      external_id text,
      sent_at timestamptz DEFAULT now(),
      created_at timestamptz DEFAULT now()
    );

    ALTER TABLE messages ADD CONSTRAINT messages_conversation_id_fkey 
      FOREIGN KEY (conversation_id) REFERENCES conversations(id);

    ALTER TABLE messages ENABLE ROW LEVEL SECURITY;
  END IF;
END $$;

-- Add policies for messages
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'messages' AND policyname = 'Users can insert messages for their conversations'
  ) THEN
    CREATE POLICY "Users can insert messages for their conversations"
      ON messages
      FOR INSERT
      TO authenticated
      WITH CHECK (EXISTS (
        SELECT 1 FROM conversations
        WHERE conversations.id = conversation_id
        AND conversations.user_id = auth.uid()
      ));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'messages' AND policyname = 'Users can view messages for their conversations'
  ) THEN
    CREATE POLICY "Users can view messages for their conversations"
      ON messages
      FOR SELECT
      TO authenticated
      USING (EXISTS (
        SELECT 1 FROM conversations
        WHERE conversations.id = conversation_id
        AND conversations.user_id = auth.uid()
      ));
  END IF;
END $$;

-- Create API rate limits table
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'api_rate_limits') THEN
    CREATE TABLE IF NOT EXISTS api_rate_limits (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id uuid NOT NULL,
      platform text NOT NULL,
      endpoint text NOT NULL,
      calls_made integer DEFAULT 0,
      reset_at timestamptz NOT NULL,
      created_at timestamptz DEFAULT now()
    );

    ALTER TABLE api_rate_limits ADD CONSTRAINT api_rate_limits_user_id_fkey 
      FOREIGN KEY (user_id) REFERENCES auth.users(id);

    ALTER TABLE api_rate_limits ENABLE ROW LEVEL SECURITY;
  END IF;
END $$;

-- Add policies for API rate limits
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'api_rate_limits' AND policyname = 'Users can view their own API rate limits'
  ) THEN
    CREATE POLICY "Users can view their own API rate limits"
      ON api_rate_limits
      FOR SELECT
      TO authenticated
      USING (auth.uid() = user_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'api_rate_limits' AND policyname = 'Users can update their own API rate limits'
  ) THEN
    CREATE POLICY "Users can update their own API rate limits"
      ON api_rate_limits
      FOR UPDATE
      TO authenticated
      USING (auth.uid() = user_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'api_rate_limits' AND policyname = 'Users can insert their own API rate limits'
  ) THEN
    CREATE POLICY "Users can insert their own API rate limits"
      ON api_rate_limits
      FOR INSERT
      TO authenticated
      WITH CHECK (auth.uid() = user_id);
  END IF;
END $$;

-- Add refreshed_at column to social_connections if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'social_connections' AND column_name = 'refreshed_at'
  ) THEN
    ALTER TABLE social_connections
    ADD COLUMN refreshed_at timestamptz;
  END IF;
END $$;

-- Create indexes if they don't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes 
    WHERE indexname = 'idx_conversations_user_id'
  ) THEN
    CREATE INDEX idx_conversations_user_id ON conversations(user_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes 
    WHERE indexname = 'idx_messages_conversation_id'
  ) THEN
    CREATE INDEX idx_messages_conversation_id ON messages(conversation_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes 
    WHERE indexname = 'idx_conversations_last_message_at'
  ) THEN
    CREATE INDEX idx_conversations_last_message_at ON conversations(last_message_at DESC);
  END IF;
END $$;