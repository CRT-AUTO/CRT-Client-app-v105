/*
  # Enhanced Webhook Management for Multiple Channels
  
  1. Modifications to webhook_configs
    - Add channel_name to better identify different channels for the same platform
    - Add channel_id to store platform-specific channel IDs
    - Add meta_verification_status to track webhook verification status
    - Add additional_config for platform-specific configuration
  
  2. Changes:
    - Support multiple webhook configurations per user per platform
    - Better tracking of Meta webhook verification process
    - Store channel-specific details for fine-grained management
*/

-- Add new columns to webhook_configs
DO $$
BEGIN
  -- Add channel_name column if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'webhook_configs' AND column_name = 'channel_name'
  ) THEN
    ALTER TABLE webhook_configs
    ADD COLUMN channel_name text;
  END IF;
  
  -- Add channel_id column if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'webhook_configs' AND column_name = 'channel_id'
  ) THEN
    ALTER TABLE webhook_configs
    ADD COLUMN channel_id text;
  END IF;
  
  -- Add meta_verification_status column if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'webhook_configs' AND column_name = 'meta_verification_status'
  ) THEN
    ALTER TABLE webhook_configs
    ADD COLUMN meta_verification_status text DEFAULT 'pending' 
    CHECK (meta_verification_status IN ('pending', 'verified', 'failed'));
  END IF;
  
  -- Add additional_config column if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'webhook_configs' AND column_name = 'additional_config'
  ) THEN
    ALTER TABLE webhook_configs
    ADD COLUMN additional_config jsonb DEFAULT '{}'::jsonb;
  END IF;
END $$;

-- Add a composite unique constraint to ensure we don't have duplicate entries
-- for the same user, platform, and channel
DO $$
BEGIN
  -- Check if the constraint already exists
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'webhook_configs_user_platform_channel_key'
  ) THEN
    ALTER TABLE webhook_configs
    ADD CONSTRAINT webhook_configs_user_platform_channel_key
    UNIQUE (user_id, platform, channel_name);
  END IF;
END $$;

-- Make sure we have the right index for efficient lookups by user_id and platform
CREATE INDEX IF NOT EXISTS idx_webhook_configs_user_platform
  ON webhook_configs(user_id, platform);