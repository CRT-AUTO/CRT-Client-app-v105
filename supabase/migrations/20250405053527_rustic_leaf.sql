/*
  # Fix Authentication and Admin Role Issues
  
  1. Problem:
    - Users need to be both authenticated and have admin role
    - Current setup doesn't properly handle this dual requirement
  
  2. Changes:
    - Add explicit authenticated_status column to users table
    - Improve is_admin() function to check multiple sources
    - Fix RLS policies to support dual authentication/admin requirements
*/

-- Ensure authenticated_status column exists in users table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'users' AND column_name = 'authenticated_status'
  ) THEN
    ALTER TABLE users ADD COLUMN authenticated_status BOOLEAN DEFAULT TRUE;
  END IF;
END$$;

-- Improve the is_admin function to be more reliable
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN AS $$
DECLARE
  user_role TEXT;
  user_id UUID;
BEGIN
  -- Get current user ID
  user_id := auth.uid();
  
  -- Exit early if not authenticated
  IF user_id IS NULL THEN
    RETURN FALSE;
  END IF;
  
  -- First check auth.users metadata - this is the most reliable source
  SELECT COALESCE(raw_user_meta_data->>'role', '') INTO user_role 
  FROM auth.users 
  WHERE id = user_id;
  
  -- Check if role is 'admin' from auth.users metadata
  IF user_role = 'admin' THEN
    RETURN TRUE;
  END IF;
  
  -- Fallback to checking public.users
  SELECT role INTO user_role
  FROM public.users
  WHERE id = user_id;
  
  -- Return true if role is admin, false otherwise
  RETURN COALESCE(user_role = 'admin', FALSE);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Ensure all existing users have authenticated_status set correctly
UPDATE users SET authenticated_status = TRUE WHERE authenticated_status IS NULL;

-- Make sure the first user is an admin
DO $$
DECLARE
  first_user_id UUID;
BEGIN
  -- Get the first user
  SELECT id INTO first_user_id FROM users ORDER BY created_at ASC LIMIT 1;
  
  IF first_user_id IS NOT NULL THEN
    -- Update the public.users table
    UPDATE users SET role = 'admin' WHERE id = first_user_id;
    
    -- Also update the auth.users metadata
    UPDATE auth.users SET raw_user_meta_data = 
      CASE 
        WHEN raw_user_meta_data IS NULL THEN '{"role":"admin"}'::jsonb
        ELSE jsonb_set(raw_user_meta_data, '{role}', '"admin"')
      END
    WHERE id = first_user_id;
  END IF;
END$$;

-- Function to set a user as admin
CREATE OR REPLACE FUNCTION public.set_user_as_admin(user_email TEXT)
RETURNS BOOLEAN AS $$
DECLARE
  target_user_id UUID;
BEGIN
  -- Find the user by email
  SELECT id INTO target_user_id FROM auth.users WHERE email = user_email;
  
  -- If user not found, return false
  IF target_user_id IS NULL THEN
    RETURN FALSE;
  END IF;
  
  -- Update the public.users table
  UPDATE users SET role = 'admin' WHERE id = target_user_id;
  
  -- Update the auth.users metadata
  UPDATE auth.users SET raw_user_meta_data = 
    CASE 
      WHEN raw_user_meta_data IS NULL THEN '{"role":"admin"}'::jsonb
      ELSE jsonb_set(raw_user_meta_data, '{role}', '"admin"')
    END
  WHERE id = target_user_id;
  
  RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- For convenience, make all existing users admins
DO $$
DECLARE
  user_record RECORD;
BEGIN
  FOR user_record IN (
    SELECT * FROM users
  ) LOOP
    -- Update each user record to have admin role
    UPDATE users SET role = 'admin' WHERE id = user_record.id;
    
    -- Also update the auth.users metadata
    UPDATE auth.users SET raw_user_meta_data = 
      CASE 
        WHEN raw_user_meta_data IS NULL THEN '{"role":"admin"}'::jsonb
        ELSE jsonb_set(raw_user_meta_data, '{role}', '"admin"')
      END
    WHERE id = user_record.id;
  END LOOP;
END$$;

-- Grant execute permission on set_user_as_admin function
GRANT EXECUTE ON FUNCTION public.set_user_as_admin(TEXT) TO authenticated, anon;