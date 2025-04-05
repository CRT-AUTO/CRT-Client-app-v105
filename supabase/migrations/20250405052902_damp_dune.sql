/*
  # Fix Authentication and Role Management
  
  1. Problem:
    - Users can't be both authenticated and have admin role
    - Admin portal access is broken due to role checking issues
  
  2. Changes:
    - Improve is_admin() function to be more reliable
    - Ensure role is properly set during authentication
    - Add fallback mechanisms for role checking
    - Fix RLS policies to check roles correctly
  
  3. Security:
    - Maintain RLS security while ensuring admin functionality works properly
*/

-- Create a more reliable is_admin() function that handles different scenarios
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
  
  -- First try to get role from auth.users.raw_user_meta_data
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

-- Ensure public.users table has all required columns
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'users' AND column_name = 'authenticated_status'
  ) THEN
    ALTER TABLE users 
    ADD COLUMN authenticated_status BOOLEAN DEFAULT TRUE;
  END IF;
END $$;

-- Drop and recreate RLS policies for the users table
DO $$
BEGIN
  -- Drop existing policies
  DROP POLICY IF EXISTS "Public can view their own user data" ON public.users;
  DROP POLICY IF EXISTS "Users can read own data" ON public.users;
  DROP POLICY IF EXISTS "Users can update their own data" ON public.users;
  DROP POLICY IF EXISTS "Admins can read all users" ON public.users;
  DROP POLICY IF EXISTS "Admins can update all users" ON public.users;
  DROP POLICY IF EXISTS "Allow insertion during signup" ON public.users;
  
  -- Recreate policies with improved role checking
  -- Allow users to read their own data
  CREATE POLICY "Users can read own data"
    ON public.users
    FOR SELECT
    TO public
    USING (auth.uid() = id);
    
  -- Allow users to update their own data
  CREATE POLICY "Users can update their own data"
    ON public.users
    FOR UPDATE
    TO authenticated
    USING (auth.uid() = id);
    
  -- Allow admins to read all users
  CREATE POLICY "Admins can read all users"
    ON public.users
    FOR SELECT
    TO public
    USING (is_admin() = true);
    
  -- Allow admins to update all users
  CREATE POLICY "Admins can update all users"
    ON public.users
    FOR UPDATE
    TO authenticated
    USING (is_admin() = true);
    
  -- Allow new user insertion (for signup)
  CREATE POLICY "Allow insertion during signup"
    ON public.users
    FOR INSERT
    TO public
    WITH CHECK (true);
END $$;

-- Create an index on the role column for better performance
CREATE INDEX IF NOT EXISTS idx_users_role ON public.users(role);

-- Make sure first user has admin role (for bootstrapping)
DO $$
DECLARE
  first_user_id UUID;
  first_auth_user_id UUID;
BEGIN
  -- First check if there are any users
  SELECT id INTO first_user_id FROM public.users ORDER BY created_at ASC LIMIT 1;
  
  -- If we found a user in public.users, ensure they have admin role
  IF first_user_id IS NOT NULL THEN
    UPDATE public.users SET role = 'admin' WHERE id = first_user_id;
    
    -- Also update auth.users metadata
    UPDATE auth.users 
    SET raw_user_meta_data = jsonb_set(
      COALESCE(raw_user_meta_data, '{}'::jsonb),
      '{role}',
      '"admin"'
    )
    WHERE id = first_user_id;
  END IF;
  
  -- Also check auth.users directly
  SELECT id INTO first_auth_user_id FROM auth.users ORDER BY created_at ASC LIMIT 1;
  
  -- If we found a user in auth.users, ensure they have admin role
  IF first_auth_user_id IS NOT NULL THEN
    UPDATE auth.users 
    SET raw_user_meta_data = jsonb_set(
      COALESCE(raw_user_meta_data, '{}'::jsonb),
      '{role}',
      '"admin"'
    )
    WHERE id = first_auth_user_id;
    
    -- Also update public.users if it exists
    IF EXISTS (SELECT 1 FROM public.users WHERE id = first_auth_user_id) THEN
      UPDATE public.users SET role = 'admin' WHERE id = first_auth_user_id;
    ELSE
      -- Create a record in public.users if it doesn't exist
      INSERT INTO public.users (id, email, role, created_at)
      SELECT id, email, 'admin', created_at
      FROM auth.users
      WHERE id = first_auth_user_id;
    END IF;
  END IF;
END $$;