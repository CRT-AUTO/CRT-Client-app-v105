/*
  # Add Webhook Token Support
  
  1. Modifications to webhook_configs
    - Add `webhook_token` column to store generated Meta webhook tokens
    - This token is provided by Meta after webhook verification
  
  2. Usage
    - Store the webhook tokens that are generated after webhook verification
    - Used for authenticating webhook API requests
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