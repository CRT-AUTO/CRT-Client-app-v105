/*
  # Sync existing auth users with public users table

  1. New Function
    - Adds a function to populate public.users for existing auth.users

  2. Schema Fixes
    - Ensures auth.users and public.users are in sync

*/

-- Create a function to populate users table with existing auth users
CREATE OR REPLACE FUNCTION public.sync_users() 
RETURNS void AS $$
DECLARE
  auth_user RECORD;
BEGIN
  FOR auth_user IN
    SELECT id, email, created_at, raw_user_meta_data->>'role' as role
    FROM auth.users
  LOOP
    -- Check if user already exists in public.users
    IF NOT EXISTS (SELECT 1 FROM public.users WHERE id = auth_user.id) THEN
      -- Insert the user if they don't exist
      INSERT INTO public.users (id, email, role, created_at)
      VALUES (
        auth_user.id, 
        auth_user.email, 
        COALESCE(auth_user.role, 'customer'), 
        auth_user.created_at
      );
    END IF;
  END LOOP;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Run the function to sync existing users
SELECT sync_users();

-- Ensure the first user is an admin
DO $$
DECLARE
  first_user_id UUID;
BEGIN
  -- Get the first user
  SELECT id INTO first_user_id FROM auth.users ORDER BY created_at ASC LIMIT 1;
  
  IF first_user_id IS NOT NULL THEN
    -- Update role to admin for the first user in both tables
    UPDATE auth.users SET raw_user_meta_data = 
      jsonb_set(
        COALESCE(raw_user_meta_data, '{}'::jsonb),
        '{role}',
        '"admin"'
      )
    WHERE id = first_user_id;
    
    UPDATE public.users SET role = 'admin' WHERE id = first_user_id;
  END IF;
END
$$;