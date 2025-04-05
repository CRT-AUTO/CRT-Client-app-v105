-- Make sure the authenticated_status column exists in users table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'users' AND column_name = 'authenticated_status'
  ) THEN
    ALTER TABLE users ADD COLUMN authenticated_status BOOLEAN DEFAULT TRUE;
  END IF;
END$$;

-- Create or replace a reliable is_admin function
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN AS $$
DECLARE
  current_user_id UUID;
  user_role TEXT;
BEGIN
  -- Get current user ID
  current_user_id := auth.uid();
  
  -- Exit early if not authenticated
  IF current_user_id IS NULL THEN
    RETURN FALSE;
  END IF;
  
  -- First check auth.users metadata (most reliable)
  SELECT raw_user_meta_data->>'role' INTO user_role
  FROM auth.users
  WHERE id = current_user_id;
  
  IF user_role = 'admin' THEN
    RETURN TRUE;
  END IF;
  
  -- Fallback to checking public.users
  SELECT role INTO user_role
  FROM public.users
  WHERE id = current_user_id;
  
  RETURN COALESCE(user_role = 'admin', FALSE);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create a ping function for connection health checks
CREATE OR REPLACE FUNCTION public.ping()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN TRUE;
END;
$$ LANGUAGE plpgsql;

-- Grant execute permissions to authenticated and anon roles
GRANT EXECUTE ON FUNCTION public.is_admin() TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.ping() TO authenticated, anon;

-- Update existing users to have authenticated_status = TRUE
UPDATE users SET authenticated_status = TRUE WHERE authenticated_status IS NULL;

-- Make sure the first user is an admin 
DO $$
DECLARE
  first_user_id UUID;
BEGIN
  -- Get the first user
  SELECT id INTO first_user_id FROM auth.users ORDER BY created_at ASC LIMIT 1;
  
  IF first_user_id IS NOT NULL THEN
    -- Update the users table
    UPDATE public.users SET role = 'admin' WHERE id = first_user_id;
    
    -- Update the auth.users metadata for the first user
    UPDATE auth.users
    SET raw_user_meta_data = jsonb_set(
      COALESCE(raw_user_meta_data, '{}'::jsonb),
      '{role}',
      '"admin"'
    )
    WHERE id = first_user_id;
  END IF;
END$$;

-- Fix users table RLS policies 
DO $$
BEGIN
  -- Drop existing policies to start fresh
  DROP POLICY IF EXISTS "Public can view their own user data" ON public.users;
  DROP POLICY IF EXISTS "Users can read own data" ON public.users;
  DROP POLICY IF EXISTS "Users can update their own data" ON public.users;
  DROP POLICY IF EXISTS "Admins can read all users" ON public.users;
  DROP POLICY IF EXISTS "Admins can update all users" ON public.users;
  DROP POLICY IF EXISTS "Allow insertion during signup" ON public.users;
END$$;

-- Create more reliable policies
CREATE POLICY "Users can read own data"
  ON public.users
  FOR SELECT
  TO public
  USING (auth.uid() = id);

CREATE POLICY "Users can update their own data"
  ON public.users
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = id);

CREATE POLICY "Admins can read all users"
  ON public.users
  FOR SELECT
  TO public
  USING (is_admin());

CREATE POLICY "Admins can update all users"
  ON public.users
  FOR UPDATE
  TO authenticated
  USING (is_admin());

CREATE POLICY "Allow insertion during signup"
  ON public.users
  FOR INSERT
  TO public
  WITH CHECK (true);