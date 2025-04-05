/*
  # Add multi-channel webhook support
  
  1. Ensure the following fields exist in webhook_configs:
    - channel_name: Identify different channels within the same platform
    - channel_id: Store platform-specific channel identifiers
    - meta_verification_status: Track verification status with Meta
    - webhook_token: Store webhook token provided by Meta after verification
    - additional_config: Store channel-specific configuration
  
  2. Add a unique constraint to ensure no duplicates 
    for the same user, platform and channel combination
  
  3. Create index for faster lookups and operations
*/

-- Add new columns to webhook_configs if they don't exist
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
  
  -- Add webhook_token column if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'webhook_configs' AND column_name = 'webhook_token'
  ) THEN
    ALTER TABLE webhook_configs
    ADD COLUMN webhook_token text;
  END IF;
  
  -- Update platform check constraint if needed
  IF EXISTS (
    SELECT 1 FROM information_schema.constraint_column_usage 
    WHERE table_name = 'webhook_configs' AND constraint_name = 'webhook_configs_platform_check'
  ) THEN
    -- Drop the existing constraint
    ALTER TABLE webhook_configs DROP CONSTRAINT webhook_configs_platform_check;
  END IF;
  
  -- Add new platform check constraint
  ALTER TABLE webhook_configs ADD CONSTRAINT webhook_configs_platform_check 
    CHECK (platform IN ('all', 'facebook', 'instagram', 'whatsapp'));
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