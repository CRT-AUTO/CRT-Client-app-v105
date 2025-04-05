-- Make sure the authenticated_status column exists
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'users' AND column_name = 'authenticated_status'
  ) THEN
    ALTER TABLE users ADD COLUMN authenticated_status BOOLEAN DEFAULT TRUE;
  END IF;
END$$;

-- Update existing users to have authenticated_status = TRUE
UPDATE users SET authenticated_status = TRUE WHERE authenticated_status IS NULL;

-- First drop the existing set_user_as_admin function to avoid parameter name conflicts
DROP FUNCTION IF EXISTS public.set_user_as_admin(text);

-- Create an improved is_admin function with proper variable declarations
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN AS $$
DECLARE
  current_user_id UUID;
  user_role TEXT;
BEGIN
  -- Get the current user's ID
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
  
  -- If not found in metadata, check public.users
  SELECT role INTO user_role
  FROM public.users
  WHERE id = current_user_id;
  
  RETURN COALESCE(user_role = 'admin', FALSE);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Make sure the is_admin function is callable via RPC
GRANT EXECUTE ON FUNCTION public.is_admin() TO authenticated, anon;

-- Add a ping function to test connectivity
CREATE OR REPLACE FUNCTION public.ping()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN TRUE;
END;
$$ LANGUAGE plpgsql;

GRANT EXECUTE ON FUNCTION public.ping() TO authenticated, anon;

-- Fix users table policies
DO $$
BEGIN
  -- Drop any conflicting policies
  DROP POLICY IF EXISTS "Public can view their own user data" ON public.users;
  DROP POLICY IF EXISTS "Public users can view their own data" ON public.users;
  DROP POLICY IF EXISTS "Users can read own data" ON public.users;
  DROP POLICY IF EXISTS "Users can update their own data" ON public.users;
  DROP POLICY IF EXISTS "Admins can read all users" ON public.users;
  DROP POLICY IF EXISTS "Admins can update all users" ON public.users;
  DROP POLICY IF EXISTS "Allow insertion during signup" ON public.users;
END$$;

-- Create policies that work for both public and authenticated roles
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

-- Ensure first user has admin role
DO $$
DECLARE
  first_user_id UUID;
BEGIN
  -- Get the first user
  SELECT id INTO first_user_id FROM auth.users ORDER BY created_at ASC LIMIT 1;
  
  IF first_user_id IS NOT NULL THEN
    -- Update auth.users metadata
    UPDATE auth.users
    SET raw_user_meta_data = 
      CASE 
        WHEN raw_user_meta_data IS NULL THEN '{"role":"admin"}'::jsonb
        ELSE jsonb_set(COALESCE(raw_user_meta_data, '{}'::jsonb), '{role}', '"admin"')
      END
    WHERE id = first_user_id;
    
    -- Update public.users table
    UPDATE public.users
    SET role = 'admin'
    WHERE id = first_user_id;
    
    -- Insert if not exists
    INSERT INTO public.users (id, email, role, created_at, authenticated_status)
    SELECT id, email, 'admin', created_at, TRUE
    FROM auth.users
    WHERE id = first_user_id
    ON CONFLICT (id) DO NOTHING;
  END IF;
END$$;

-- Sync user roles between tables
DO $$
DECLARE
  auth_user RECORD;
  pub_user RECORD;
BEGIN
  -- Update auth.users from public.users roles
  FOR pub_user IN SELECT * FROM public.users LOOP
    UPDATE auth.users
    SET raw_user_meta_data = 
      CASE 
        WHEN raw_user_meta_data IS NULL THEN jsonb_build_object('role', pub_user.role)
        ELSE jsonb_set(COALESCE(raw_user_meta_data, '{}'::jsonb), '{role}', to_jsonb(pub_user.role))
      END
    WHERE id = pub_user.id;
  END LOOP;
  
  -- Create missing public.users records
  FOR auth_user IN 
    SELECT id, email, created_at, raw_user_meta_data->>'role' AS role
    FROM auth.users
    WHERE NOT EXISTS (SELECT 1 FROM public.users WHERE id = auth.users.id)
  LOOP
    INSERT INTO public.users (id, email, role, created_at, authenticated_status)
    VALUES (
      auth_user.id,
      auth_user.email,
      COALESCE(auth_user.role, 'customer'),
      auth_user.created_at,
      TRUE
    )
    ON CONFLICT (id) DO NOTHING;
  END LOOP;
END$$;

-- Create admin role helper function with consistent parameter name
CREATE OR REPLACE FUNCTION public.set_user_as_admin(user_email TEXT)
RETURNS BOOLEAN AS $$
DECLARE
  target_id UUID;
BEGIN
  -- Find the user ID
  SELECT id INTO target_id FROM auth.users WHERE email = user_email;
  
  IF target_id IS NULL THEN
    RETURN FALSE;
  END IF;
  
  -- Update auth.users
  UPDATE auth.users
  SET raw_user_meta_data = jsonb_set(
    COALESCE(raw_user_meta_data, '{}'::jsonb),
    '{role}',
    '"admin"'
  )
  WHERE id = target_id;
  
  -- Update public.users
  UPDATE public.users
  SET role = 'admin'
  WHERE id = target_id;
  
  RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION public.set_user_as_admin(TEXT) TO authenticated;