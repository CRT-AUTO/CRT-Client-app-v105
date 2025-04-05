/*
  # Add Webhook Token to Webhook Configs Table
  
  1. Changes
    - Add webhook_token column to webhook_configs table to store Meta-provided tokens
  
  2. Purpose
    - Store the authentication token provided by Meta after webhook verification
    - Required for verifying incoming webhook requests
*/

-- Add webhook_token column to webhook_configs table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'webhook_configs' AND column_name = 'webhook_token'
  ) THEN
    ALTER TABLE webhook_configs
    ADD COLUMN webhook_token text;
  END IF;
END $$;