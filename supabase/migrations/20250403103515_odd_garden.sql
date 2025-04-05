/*
  # Fix admin permissions for users table - revised version
  
  1. Problem:
    - Currently admins get "permission denied for table users" when trying to access the users table
    - This affects the admin dashboard functionality
  
  2. Changes:
    - Modify the is_admin() function to be more robust
    - Update the RLS policies for the users table to ensure admins can access it
    - Provide additional fallback mechanisms for role checking
  
  3. Security:
    - Maintain RLS protection while ensuring admin functionality works properly
*/

-- First, let's update the is_admin function to be more robust
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN AS $$
DECLARE
  user_role TEXT;
BEGIN
  -- First try to get the role from auth.users
  SELECT role INTO user_role 
  FROM auth.users 
  WHERE id = auth.uid();
  
  -- If found in auth.users, check if it's admin
  IF user_role IS NOT NULL THEN
    RETURN user_role = 'admin';
  END IF;
  
  -- Fallback to checking public.users
  SELECT role INTO user_role
  FROM public.users
  WHERE id = auth.uid();
  
  -- Return true if role is admin, false otherwise
  RETURN COALESCE(user_role = 'admin', false);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Drop existing policies for the users table to avoid conflicts - use a DO block for safety
DO $$
BEGIN
  -- Drop policies if they exist
  DROP POLICY IF EXISTS "Admins can view all users" ON public.users;
  DROP POLICY IF EXISTS "Public users can view their own data" ON public.users;
  DROP POLICY IF EXISTS "Enable insert during signup" ON public.users;
  DROP POLICY IF EXISTS "Users can view their own user data" ON public.users;
  DROP POLICY IF EXISTS "Admins can read all users" ON public.users;
  DROP POLICY IF EXISTS "Users can read own data" ON public.users;
  DROP POLICY IF EXISTS "Allow insertion during signup" ON public.users;
END $$;

-- Create policies only if they don't exist - safer approach
DO $$
BEGIN
  -- Create policy for admins to read all users if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'users' AND policyname = 'Admins can read all users'
  ) THEN
    CREATE POLICY "Admins can read all users"
      ON public.users
      FOR SELECT
      USING (is_admin());
  END IF;

  -- Create policy for users to read their own data if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'users' AND policyname = 'Users can read own data'
  ) THEN
    CREATE POLICY "Users can read own data"
      ON public.users
      FOR SELECT
      USING (auth.uid() = id);
  END IF;

  -- Create policy for users to update their own data if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'users' AND policyname = 'Users can update their own data'
  ) THEN
    CREATE POLICY "Users can update their own data"
      ON public.users
      FOR UPDATE
      USING (auth.uid() = id);
  END IF;

  -- Create policy for admins to update any user if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'users' AND policyname = 'Admins can update any user'
  ) THEN
    CREATE POLICY "Admins can update any user"
      ON public.users
      FOR UPDATE
      USING (is_admin());
  END IF;

  -- Create policy for insertion during signup if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'users' AND policyname = 'Allow insertion during signup'
  ) THEN
    CREATE POLICY "Allow insertion during signup"
      ON public.users
      FOR INSERT
      WITH CHECK (true);
  END IF;
END $$;

-- Create an index on the role column for better performance
CREATE INDEX IF NOT EXISTS idx_users_role ON public.users(role);

-- Verify users table has RLS enabled
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

-- Grant usage on the auth schema to the authenticated and anon roles
GRANT USAGE ON SCHEMA auth TO authenticated, anon;

-- Sync auth.users roles with public.users
DO $$
DECLARE
  auth_user RECORD;
BEGIN
  FOR auth_user IN
    SELECT id, email, role, created_at
    FROM auth.users
  LOOP
    -- Upsert users to ensure consistency
    INSERT INTO public.users (id, email, role, created_at)
    VALUES (
      auth_user.id,
      auth_user.email,
      COALESCE(auth_user.role, 'customer'),
      auth_user.created_at
    )
    ON CONFLICT (id) 
    DO UPDATE SET
      email = EXCLUDED.email,
      role = COALESCE(EXCLUDED.role, public.users.role, 'customer'),
      created_at = EXCLUDED.created_at;
  END LOOP;
END;
$$ LANGUAGE plpgsql;