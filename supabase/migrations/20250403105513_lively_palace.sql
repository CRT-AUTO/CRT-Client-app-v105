-- Function to ping the Supabase server to check connectivity
CREATE OR REPLACE FUNCTION public.ping()
RETURNS boolean AS
$$
BEGIN
  RETURN true;
END;
$$ LANGUAGE plpgsql;

-- Grant execution permissions to all authenticated and anonymous users
GRANT EXECUTE ON FUNCTION public.ping() TO authenticated, anon;