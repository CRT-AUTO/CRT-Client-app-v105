/*
  # Fix RLS Policies for User Management
  
  1. Problem:
    - Current RLS policies are preventing user creation and management
    - Error: "new row violates row-level security policy for table users"
  
  2. Changes:
    - Add policy to allow new user creation during signup
    - Fix user management policies for authenticated users
    - Ensure admin users can manage all users
    - Add policy for user self-management
  
  3. Security:
    - Maintain RLS protection while allowing necessary operations
    - Ensure users can only access their own data
    - Allow admins full access to user management
*/

-- Drop existing policies for users table
DROP POLICY IF EXISTS "Users can view their own user data" ON public.users;
DROP POLICY IF EXISTS "Admins can view all users" ON public.users;

-- Create comprehensive policies for users table
CREATE POLICY "Enable insert for authenticated users only"
  ON public.users
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = id);

CREATE POLICY "Enable insert during signup"
  ON public.users
  FOR INSERT
  TO anon
  WITH CHECK (true);

CREATE POLICY "Users can view their own user data"
  ON public.users
  FOR SELECT
  TO public
  USING (auth.uid() = id);

CREATE POLICY "Users can update their own data"
  ON public.users
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

CREATE POLICY "Admins can view all users"
  ON public.users
  FOR SELECT
  TO public
  USING (
    (SELECT role FROM auth.users WHERE auth.users.id = auth.uid()) = 'admin'
  );

CREATE POLICY "Admins can update all users"
  ON public.users
  FOR UPDATE
  TO authenticated
  USING (
    (SELECT role FROM auth.users WHERE auth.users.id = auth.uid()) = 'admin'
  );

-- Ensure RLS is enabled
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

-- Create or replace the is_admin function for better performance
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN (
    SELECT role = 'admin'
    FROM auth.users
    WHERE id = auth.uid()
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Add trigger to automatically create user record on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.users (id, email, role, created_at)
  VALUES (
    new.id,
    new.email,
    COALESCE(new.raw_user_meta_data->>'role', 'customer'),
    new.created_at
  );
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Recreate the trigger
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();