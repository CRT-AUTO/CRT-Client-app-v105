/*
  # Create users table and fix database schema

  1. New Tables
    - `users` - Main users table to store user information
      - `id` (uuid, primary key)
      - `email` (text, not null)
      - `role` (text, default 'customer')
      - `created_at` (timestamp with time zone)

  2. Functions
    - `is_admin()` - Function to check if current user is an admin

  3. Changes
    - Add role column to auth.users
    - Create webhook_configs table and policies
    - Modify existing RLS policies for admin access
*/

-- Create users table if it doesn't exist
CREATE TABLE IF NOT EXISTS public.users (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  role TEXT DEFAULT 'customer',
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Add a role column to the users table via auth.users
ALTER TABLE auth.users ADD COLUMN IF NOT EXISTS role TEXT DEFAULT 'customer';

-- Create a function to check if the current user is an admin
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

-- Create webhook_configs table to store per-user webhook configurations
CREATE TABLE IF NOT EXISTS public.webhook_configs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  webhook_url TEXT,
  verification_token TEXT,
  is_active BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS on webhook_configs
ALTER TABLE public.webhook_configs ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for webhook_configs
CREATE POLICY "Users can view their own webhook configs"
  ON public.webhook_configs
  FOR SELECT
  USING ((auth.uid() = user_id) OR (is_admin() = true));

CREATE POLICY "Only admins can insert webhook configs"
  ON public.webhook_configs
  FOR INSERT
  WITH CHECK (is_admin() = true);

CREATE POLICY "Only admins can update webhook configs"
  ON public.webhook_configs
  FOR UPDATE
  USING (is_admin() = true);

-- Enable RLS on users table
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for users table
CREATE POLICY "Users can view their own user data"
  ON public.users
  FOR SELECT
  USING (auth.uid() = id);

CREATE POLICY "Admins can view all users"
  ON public.users
  FOR SELECT
  USING (is_admin() = true);

-- Modify existing RLS policies to allow admin access

-- For voiceflow_mappings table
CREATE POLICY "Admins can view all voiceflow mappings"
  ON public.voiceflow_mappings
  FOR SELECT
  TO authenticated
  USING (is_admin() = true);

CREATE POLICY "Admins can update all voiceflow mappings"
  ON public.voiceflow_mappings
  FOR UPDATE
  TO authenticated
  USING (is_admin() = true);

CREATE POLICY "Admins can create voiceflow mappings for any user"
  ON public.voiceflow_mappings
  FOR INSERT
  TO authenticated
  WITH CHECK (is_admin() = true);

-- For social_connections table
CREATE POLICY "Admins can view all social connections"
  ON public.social_connections
  FOR SELECT
  TO authenticated
  USING (is_admin() = true);

-- For conversations table
CREATE POLICY "Admins can view all conversations"
  ON public.conversations
  FOR SELECT
  TO authenticated
  USING (is_admin() = true);

-- For messages table
CREATE POLICY "Admins can view all messages"
  ON public.messages
  FOR SELECT
  TO authenticated
  USING (is_admin() = true);

-- Create a trigger to automatically create a user record when a new auth user is created
CREATE OR REPLACE FUNCTION public.handle_new_user() 
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.users (id, email, role, created_at)
  VALUES (new.id, new.email, new.raw_user_meta_data->>'role', new.created_at);
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger the function every time a user is created
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();