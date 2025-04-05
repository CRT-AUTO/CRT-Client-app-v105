/*
  # Fix Users Table RLS Policies
  
  1. Problem:
    - Client-side operations are getting "permission denied for table users" errors
    
  2. Changes:
    - Modify RLS policies to allow users to read their own data
    - Add public access for authenticated users to read their own role
  
  3. Security:
    - Maintain RLS protection to prevent unauthorized access
    - Only allow users to access their own data
*/

-- Drop and recreate the users view policy
DROP POLICY IF EXISTS "Users can view their own user data" ON public.users;
DROP POLICY IF EXISTS "Admins can view all users" ON public.users;

-- Create row level security policy with broader read permissions
CREATE POLICY "Public can view their own user data"
  ON public.users
  FOR SELECT
  TO public
  USING (auth.uid() = id);

-- Create admin policy for viewing all users
CREATE POLICY "Admins can view all users"
  ON public.users
  FOR SELECT
  TO public
  USING (
    (SELECT role FROM auth.users WHERE auth.users.id = auth.uid()) = 'admin'
  );

-- Make sure RLS is enabled
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;