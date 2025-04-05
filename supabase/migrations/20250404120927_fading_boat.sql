/*
  # Add ping RPC function for connection health checks
  
  1. Purpose
    - Creates a lightweight RPC function to check database connectivity
    - Much more efficient than a full table query
    - Helps reduce load on database while still maintaining connectivity checks
  
  2. Usage
    - Call supabase.rpc('ping') from client to check connection
    - Returns true if connected, errors if disconnected
*/

-- Create a simple RPC function to check connectivity
CREATE OR REPLACE FUNCTION public.ping()
RETURNS boolean AS $$
BEGIN
  RETURN true;
END;
$$ LANGUAGE plpgsql;

-- Grant execution permissions
GRANT EXECUTE ON FUNCTION public.ping() TO authenticated, anon;