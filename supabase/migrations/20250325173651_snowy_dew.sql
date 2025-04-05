-- Add webhook_token column to webhook_configs table if it doesn't exist
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