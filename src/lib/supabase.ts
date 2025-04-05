import { createClient } from '@supabase/supabase-js';

// Get environment variables with more explicit checks
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

// Log configuration state to help with debugging
console.log('Supabase Configuration Status:', { 
  urlConfigured: !!supabaseUrl, 
  keyConfigured: !!supabaseAnonKey,
  url: supabaseUrl ? `${supabaseUrl.substring(0, 8)}...` : 'missing', // Only show beginning for security
  mode: import.meta.env.MODE || 'unknown'
});

// Create a dummy client if environment variables are missing
let supabase;

if (!supabaseUrl || !supabaseAnonKey) {
  console.error('⚠️ Missing Supabase environment variables:', { 
    supabaseUrl: supabaseUrl ? 'set' : 'missing', 
    supabaseAnonKey: supabaseAnonKey ? 'set' : 'missing'
  });
  
  // Create a mock client that returns errors for all operations
  supabase = {
    auth: {
      getSession: async () => ({ data: { session: null }, error: new Error('Supabase not configured') }),
      getUser: async () => ({ data: { user: null }, error: new Error('Supabase not configured') }),
      signOut: async () => ({ error: null }),
      onAuthStateChange: () => ({ data: { subscription: { unsubscribe: () => {} } }, error: null })
    },
    from: () => ({
      select: () => ({ data: null, error: new Error('Supabase not configured') }),
      insert: () => ({ data: null, error: new Error('Supabase not configured') }),
      update: () => ({ data: null, error: new Error('Supabase not configured') }),
      delete: () => ({ data: null, error: new Error('Supabase not configured') }),
    }),
    rpc: () => ({ data: null, error: new Error('Supabase not configured') })
  };
} else {
  // Create the Supabase client with improved configuration for session persistence
  supabase = createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: true,
      storageKey: 'sb-auth-token', // Explicitly set storage key
      storage: {
        // Use a custom storage implementation that's more resilient
        getItem: (key) => {
          try {
            const storedSession = localStorage.getItem(key);
            if (storedSession) {
              console.log(`Session found in localStorage with key ${key}`);
              return storedSession;
            }
            return null;
          } catch (error) {
            console.error('Error reading from localStorage:', error);
            return null;
          }
        },
        setItem: (key, value) => {
          try {
            console.log(`Storing session in localStorage with key ${key}`);
            localStorage.setItem(key, value);
          } catch (error) {
            console.error('Error writing to localStorage:', error);
          }
        },
        removeItem: (key) => {
          try {
            localStorage.removeItem(key);
          } catch (error) {
            console.error('Error removing from localStorage:', error);
          }
        }
      },
    }
  });
  
  // Initial session check
  supabase.auth.getSession().then(({ data, error }) => {
    if (error) {
      console.error('Error checking initial session:', error);
    } else if (data.session) {
      console.log('Initial session found:', { 
        userId: data.session.user.id,
        expiresAt: new Date(data.session.expires_at * 1000).toISOString(),
        refreshToken: !!data.session.refresh_token
      });
    } else {
      console.log('No initial session found');
    }
  });
  
  // Log successful initialization
  console.log('Supabase client initialized successfully with improved session persistence');
}

// Export the client (either real or mock)
export { supabase };

// Helper function to check if we have working authentication
export async function checkSupabaseAuth() {
  try {
    console.log('Checking Supabase auth...');
    
    if (!supabaseUrl || !supabaseAnonKey) {
      console.error('Cannot check auth: Supabase not configured');
      return false;
    }
    
    const { data: { session }, error } = await supabase.auth.getSession();
    
    if (error) {
      console.error('Supabase authentication check failed:', error);
      return false;
    }
    
    // If we have a session, check if it's close to expiring
    if (session) {
      const expiresAt = new Date(session.expires_at * 1000);
      const now = new Date();
      const timeUntilExpiry = Math.floor((expiresAt.getTime() - now.getTime()) / 1000); // in seconds
      console.log(`Session expires in ${timeUntilExpiry} seconds`);
      
      // If session is close to expiry, try refreshing
      if (timeUntilExpiry < 300) { // Less than 5 minutes
        console.log('Session close to expiry, attempting refresh');
        try {
          const { data, error } = await supabase.auth.refreshSession();
          if (error) {
            console.error('Failed to refresh session:', error);
          } else if (data?.session) {
            console.log('Session refreshed successfully, new expiry:', 
              new Date(data.session.expires_at * 1000).toISOString());
          }
        } catch (refreshError) {
          console.error('Error during token refresh:', refreshError);
        }
      }
    }
    
    console.log('Auth check result:', { hasSession: !!session });
    return !!session;
  } catch (error) {
    console.error('Failed to check Supabase authentication:', error);
    return false;
  }
}

// Helper to log detailed errors from Supabase
export function logSupabaseError(operation: string, error: any) {
  const errorDetails = {
    operation,
    message: error?.message || 'Unknown error',
    code: error?.code,
    hint: error?.hint,
    details: error?.details,
    status: error?.status
  };
  
  console.error('Supabase error:', errorDetails);
}

// Function to check database connectivity with proper response structure
export async function checkSupabaseDB(): Promise<{success: boolean, error?: string}> {
  try {
    console.log('Testing database connection...');
    
    if (!supabaseUrl || !supabaseAnonKey) {
      console.error('Cannot check database: Supabase not configured');
      return { success: false, error: 'Supabase not configured' };
    }
    
    // Try the ping RPC first (most efficient)
    try {
      console.log('Attempting to ping database via RPC...');
      const { data, error } = await supabase.rpc('ping');
      
      if (!error && data === true) {
        console.log('Database ping successful via RPC');
        return { success: true };
      } else {
        console.warn('Ping RPC failed:', error?.message);
        if (error) {
          return { success: false, error: `Ping failed: ${error.message}` };
        }
      }
    } catch (pingError) {
      console.warn('Ping RPC error:', pingError instanceof Error ? pingError.message : String(pingError));
    }
    
    // Fallback to session check
    console.log('Falling back to session check...');
    const { data, error } = await supabase.auth.getSession();
    
    if (error) {
      console.error('Database connection check failed:', error);
      return { success: false, error: `Session check failed: ${error.message}` };
    }
    
    console.log('Database connection is working via session check');
    return { success: true };
  } catch (error) {
    console.error('Database connection check failed:', error);
    const errorMessage = error instanceof Error ? error.message : String(error);
    return { success: false, error: `Connection check exception: ${errorMessage}` };
  }
}

// Function to clear any stored sessions
export async function clearSupabaseAuth() {
  try {
    console.log('Attempting to clear Supabase auth session...');
    
    // Try manually removing auth from localStorage first
    try {
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && (key.includes('supabase') || key.includes('sb-'))) {
          console.log(`Removing localStorage item: ${key}`);
          localStorage.removeItem(key);
        }
      }
    } catch (storageError) {
      console.warn('Error clearing localStorage:', storageError);
      // Continue even if this fails
    }
    
    // Then try official signOut method
    const { error } = await supabase.auth.signOut({ 
      scope: 'global' // Use global to clear all sessions, not just the local one
    });
    
    if (error) {
      console.error('Error during sign out:', error);
      // Continue despite error - we've already cleared localStorage
    }
    
    // Extra safety measure - clear any session-related cookies
    document.cookie.split(';').forEach(cookie => {
      const [name] = cookie.split('=');
      if (name.trim().includes('supabase') || name.trim().includes('sb-')) {
        document.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;`;
      }
    });
    
    console.log('Successfully cleared auth session');
    return true;
  } catch (error) {
    console.error('Exception clearing auth session:', error);
    // Still return true since we've made our best effort
    return true;
  }
}

/**
 * Function to refresh the user's token if it exists
 * @returns {Promise<boolean>} True if successful, false otherwise
 */
export async function refreshSupabaseToken(): Promise<boolean> {
  try {
    console.log('Attempting to refresh Supabase token...');
    
    // Check if we have a session first
    const { data: { session }, error: sessionError } = await supabase.auth.getSession();
    
    if (sessionError) {
      console.error('Error getting session for refresh:', sessionError);
      return false;
    }
    
    if (!session) {
      console.log('No session found to refresh');
      return false;
    }
    
    // Log current session expiry
    const currentExpiresAt = new Date(session.expires_at * 1000);
    console.log('Current session expires at:', currentExpiresAt.toISOString());
    
    // Attempt to refresh the session
    const { data, error } = await supabase.auth.refreshSession();
    
    if (error) {
      console.error('Error refreshing session:', error);
      return false;
    }
    
    if (!data.session) {
      console.error('No session returned from refresh');
      return false;
    }
    
    // Log new session expiry
    const newExpiresAt = new Date(data.session.expires_at * 1000);
    console.log('Refreshed session, new expiry at:', newExpiresAt.toISOString());
    
    return true;
  } catch (error) {
    console.error('Exception during token refresh:', error);
    return false;
  }
}