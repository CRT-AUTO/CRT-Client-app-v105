-- Drop potentially conflicting policies to start fresh
DROP POLICY IF EXISTS "Public can view their own user data" ON public.users;
DROP POLICY IF EXISTS "Public users can view their own data" ON public.users;
DROP POLICY IF EXISTS "Enable insert for authenticated users only" ON public.users;
DROP POLICY IF EXISTS "Enable insert during signup" ON public.users;
DROP POLICY IF EXISTS "Users can read own data" ON public.users;
DROP POLICY IF EXISTS "Users can view their own user data" ON public.users;
DROP POLICY IF EXISTS "Users can update their own data" ON public.users;
DROP POLICY IF EXISTS "Admins can read all users" ON public.users;
DROP POLICY IF EXISTS "Admins can view all users" ON public.users;
DROP POLICY IF EXISTS "Admins can update any user" ON public.users;
DROP POLICY IF EXISTS "Admins can update all users" ON public.users;
DROP POLICY IF EXISTS "Allow insertion during signup" ON public.users;

-- Create new policies with simpler, more reliable checks

-- PUBLIC POLICIES (accessible via anon key)
-- Allow public users to read their own data
CREATE POLICY "Public can view their own user data"
  ON public.users
  FOR SELECT
  TO public
  USING (auth.uid() = id);

-- Allow signup - needed for initial user creation
CREATE POLICY "Allow insertion during signup"
  ON public.users
  FOR INSERT
  TO public
  WITH CHECK (true);

-- AUTHENTICATED POLICIES
-- Allow authenticated users to read their own data
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
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- Enable insert for authenticated users (their own records)
CREATE POLICY "Enable insert for authenticated users only"
  ON public.users
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = id);

-- ADMIN POLICIES
-- Allow admins to read all user data
CREATE POLICY "Admins can read all users"
  ON public.users
  FOR SELECT
  TO public
  USING (is_admin());

-- Allow admins to update any user
CREATE POLICY "Admins can update all users"
  ON public.users
  FOR UPDATE
  TO authenticated
  USING ((( SELECT users_1.role
     FROM auth.users users_1
    WHERE (users_1.id = auth.uid())))::text = 'admin'::text);

-- Make sure is_admin() function is optimized
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN AS $$
DECLARE
  is_admin_role BOOLEAN;
BEGIN
  -- Direct check from auth.users for performance
  SELECT (role = 'admin') INTO is_admin_role
  FROM auth.users
  WHERE id = auth.uid();
  
  -- Return result with fallback to false
  RETURN COALESCE(is_admin_role, false);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create index on the role column if it doesn't exist
CREATE INDEX IF NOT EXISTS idx_users_role 
  ON public.users(role);

-- Make sure RLS is enabled
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;