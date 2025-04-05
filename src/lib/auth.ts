import { supabase } from './supabase';
import type { User, AuthStatus } from '../types';

/**
 * Get the current authenticated user with enhanced error handling
 */
export async function getCurrentUser(): Promise<User | null> {
  try {
    console.log('Getting current user...');
    
    // Get the current session first
    const { data: { session }, error: sessionError } = await supabase.auth.getSession();
    
    if (sessionError) {
      console.error('Error getting session:', sessionError);
      return null;
    }

    if (!session?.user) {
      console.log('No active session found');
      return null;
    }

    console.log(`Session found for user ID: ${session.user.id}`);
    console.log(`Session expires at: ${new Date(session.expires_at * 1000).toLocaleString()}`);

    // Try to get user data from the public users table
    try {
      const { data: userData, error: userError } = await supabase
        .from('users')
        .select('*')
        .eq('id', session.user.id)
        .single();

      if (userError) {
        console.error('Error getting user data from public.users:', userError);
        
        // If permission denied, fallback to using session data directly
        if (userError.code === '42501') {
          console.log('Permission denied for user table, using session data directly');
          return {
            id: session.user.id,
            email: session.user.email || '',
            role: session.user.user_metadata?.role || 'customer',
            created_at: session.user.created_at || new Date().toISOString(),
            isAuthenticated: true
          };
        }
      }

      if (userData) {
        console.log('Found user data in public.users table');
        
        // Update last sign-in time and authenticated status
        try {
          await supabase
            .from('users')
            .update({ 
              last_sign_in: new Date().toISOString(),
              authenticated_status: true
            })
            .eq('id', session.user.id);
        } catch (updateError) {
          console.error('Error updating last sign-in time:', updateError);
          // Non-fatal error, continue
        }
        
        return {
          ...userData,
          isAuthenticated: true // Explicitly mark as authenticated
        } as User;
      } else {
        console.log('Creating minimal user object from session data');
        
        // Try to create a new user record
        try {
          const { data: insertData, error: insertError } = await supabase
            .from('users')
            .insert([{
              id: session.user.id,
              email: session.user.email || '',
              role: session.user.user_metadata?.role || 'customer',
              created_at: session.user.created_at || new Date().toISOString(),
              last_sign_in: new Date().toISOString(),
              authenticated_status: true
            }])
            .select('*');
          
          if (insertError) {
            console.error('Error creating user record:', insertError);
            
            // If permission denied, use session data directly
            if (insertError.code === '42501') {
              console.log('Permission denied for inserting user, using session data');
              return {
                id: session.user.id,
                email: session.user.email || '',
                role: session.user.user_metadata?.role || 'customer',
                created_at: session.user.created_at || new Date().toISOString(),
                isAuthenticated: true
              };
            }
          } else if (insertData && insertData.length > 0) {
            console.log('Created new user record in public.users table');
            return {
              ...insertData[0],
              isAuthenticated: true
            } as User;
          }
        } catch (insertCatchError) {
          console.error('Exception during user record creation:', insertCatchError);
        }
      }
    } catch (e) {
      console.error('Exception during user data query:', e);
    }

    // If we get here, we'll create a minimal user object from session data
    console.log('Using session data to create minimal user object');
    return {
      id: session.user.id,
      email: session.user.email || '',
      role: session.user.user_metadata?.role || 'customer',
      created_at: session.user.created_at || new Date().toISOString(),
      isAuthenticated: true // Explicitly mark as authenticated
    };
  } catch (error) {
    console.error('Unexpected error in getCurrentUser:', error);
    return null;
  }
}

/**
 * Check if the current user has admin role
 */
export async function isAdmin(): Promise<boolean> {
  try {
    const { data: { session }, error } = await supabase.auth.getSession();
    
    if (error) {
      console.error('Error getting session:', error);
      return false;
    }

    if (!session?.user) {
      return false;
    }

    // First check user metadata from session
    if (session.user.user_metadata?.role === 'admin') {
      console.log('Admin check from session metadata: true');
      return true;
    }

    // Next try to get role from users table
    try {
      const { data: userData, error: userError } = await supabase
        .from('users')
        .select('role')
        .eq('id', session.user.id)
        .single();

      if (!userError && userData) {
        const isAdminRole = userData.role === 'admin';
        console.log(`Admin check from users table: ${isAdminRole}`);
        return isAdminRole;
      }
      
      // If permission denied, we already checked user metadata above
      if (userError && userError.code === '42501') {
        console.log('Permission denied when checking admin status in DB, using metadata');
        return session.user.user_metadata?.role === 'admin';
      }
    } catch (e) {
      console.error('Error checking admin status in public.users table:', e);
    }

    // Fall back to checking the RPC function
    try {
      const { data, error: rpcError } = await supabase.rpc('is_admin');
      
      if (!rpcError) {
        console.log(`Admin check from is_admin() RPC: ${data}`);
        return !!data;
      }
    } catch (rpcError) {
      console.error('Error using is_admin RPC:', rpcError);
    }

    // If all checks fail, assume not admin
    return false;
  } catch (error) {
    console.error('Error checking admin status:', error);
    return false;
  }
}

/**
 * Get complete authenticated status with user data
 */
export async function getAuthStatus(): Promise<AuthStatus> {
  try {
    // Default status
    const defaultStatus: AuthStatus = {
      isAuthenticated: false,
      isAdmin: false,
      user: null,
      loading: false,
      error: null
    };

    // First check if we have a session
    const { data: { session }, error: sessionError } = await supabase.auth.getSession();
    
    if (sessionError) {
      console.error('Error getting auth status session:', sessionError);
      return {
        ...defaultStatus,
        error: sessionError.message
      };
    }

    if (!session?.user) {
      // No active session
      return defaultStatus;
    }

    // We have a session, get the user data
    const user = await getCurrentUser();
    
    if (!user) {
      return {
        ...defaultStatus,
        isAuthenticated: true, // Session exists but couldn't get full user data
        error: 'Could not retrieve user data'
      };
    }

    // Check admin status
    const adminStatus = await isAdmin();

    return {
      isAuthenticated: true,
      isAdmin: adminStatus,
      user,
      loading: false,
      error: null
    };
  } catch (error) {
    console.error('Error getting auth status:', error);
    return {
      isAuthenticated: false,
      isAdmin: false,
      user: null,
      loading: false,
      error: error instanceof Error ? error.message : 'Unknown error getting auth status'
    };
  }
}

/**
 * Logs the user out by signing out of Supabase auth
 */
export async function logout() {
  try {
    const { error } = await supabase.auth.signOut({
      scope: 'global' // Sign out of all sessions, not just the current browser
    });
    
    if (error) {
      console.error('Error logging out:', error);
      throw error;
    }

    // Clear all local storage related to auth
    try {
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && (key.includes('supabase') || key.includes('sb-'))) {
          localStorage.removeItem(key);
        }
      }
    } catch (e) {
      console.error('Failed to clear local storage during logout:', e);
    }

    // Successfully logged out
    return true;
  } catch (error) {
    console.error('Error during logout:', error);
    throw error;
  }
}

/**
 * Refresh the auth token
 * @returns {Promise<boolean>} True if successful, false otherwise
 */
export async function refreshAuthToken(): Promise<boolean> {
  try {
    console.log('Attempting to refresh auth token...');
    
    const { data, error } = await supabase.auth.refreshSession();
    
    if (error) {
      console.error('Error refreshing token:', error);
      return false;
    }
    
    if (!data.session) {
      console.warn('No session returned after token refresh');
      return false;
    }
    
    console.log('Token refreshed successfully, new expiry:', 
      new Date(data.session.expires_at * 1000).toLocaleString());
    
    return true;
  } catch (error) {
    console.error('Exception during token refresh:', error);
    return false;
  }
}