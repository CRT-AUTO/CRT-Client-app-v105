/*
  # Allow Anon Key Access to Required Tables
  
  1. Problem:
    - Frontend is experiencing "No API key found in request" errors
    - Client-side code needs access to specific tables using the anon key
  
  2. Changes:
    - Add policies for the anon key (public) for required tables
    - Adjust RLS policies to ensure proper access
  
  3. Security:
    - Maintain core security model with appropriate restrictions
    - Only grant anon key read access to specific tables where needed
*/

-- Drop any existing policies that might conflict (if needed)
DROP POLICY IF EXISTS "Public can view their own social connections" ON social_connections;
DROP POLICY IF EXISTS "Public can view their own voiceflow mappings" ON voiceflow_mappings;
DROP POLICY IF EXISTS "Public can view their own conversations" ON conversations; 
DROP POLICY IF EXISTS "Public can view messages for their own conversations" ON messages;

-- Allow anon key access to social_connections for currently authenticated users
CREATE POLICY "Public can view their own social connections"
  ON social_connections
  FOR SELECT
  TO public  -- This includes the anon key
  USING (auth.uid() = user_id);

-- Allow anon key access to voiceflow_mappings for the currently authenticated users
CREATE POLICY "Public can view their own voiceflow mappings"
  ON voiceflow_mappings
  FOR SELECT
  TO public
  USING (auth.uid() = user_id);

-- Allow anon key access to conversations
CREATE POLICY "Public can view their own conversations"
  ON conversations
  FOR SELECT
  TO public
  USING (auth.uid() = user_id);

-- Allow anon key access to messages (where the conversation is owned by the user)
CREATE POLICY "Public can view messages for their own conversations"
  ON messages
  FOR SELECT
  TO public
  USING (EXISTS (
    SELECT 1 FROM conversations
    WHERE conversations.id = conversation_id
    AND conversations.user_id = auth.uid()
  ));