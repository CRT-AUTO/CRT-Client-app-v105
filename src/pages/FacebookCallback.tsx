import React, { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { MessageSquare, AlertCircle, Facebook } from 'lucide-react';
import { restoreFacebookAuthState } from '../lib/facebookAuth';

// Type definition for Facebook Page
interface FacebookPage {
  id: string;
  name: string;
  access_token: string;
  category: string;
}

export default function FacebookCallback() {
  const [error, setError] = useState<string | null>(null);
  const [processing, setProcessing] = useState(true);
  const [status, setStatus] = useState<'processing' | 'auth_restore' | 'exchanging_code' | 'getting_pages' | 'saving' | 'success' | 'error'>('processing');
  const [debugInfo, setDebugInfo] = useState<string[]>([]);
  const [selectedPageId, setSelectedPageId] = useState<string | null>(null);
  const [availablePages, setAvailablePages] = useState<FacebookPage[]>([]);
  const [authRestoreAttempted, setAuthRestoreAttempted] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();

  const addDebugInfo = (message: string) => {
    console.log(message);
    setDebugInfo(prev => [...prev, `${new Date().toISOString().slice(11, 19)}: ${message}`]);
  };

  // First, make sure our authentication is restored
  useEffect(() => {
    const restoreAuth = async () => {
      if (authRestoreAttempted) return;
      
      addDebugInfo('Attempting to restore authentication state');
      setStatus('auth_restore');
      
      // Check if we have saved auth state
      const savedState = localStorage.getItem('fb_auth_state');
      if (savedState) {
        try {
          const parsedState = JSON.parse(savedState);
          addDebugInfo(`Found saved auth state for user ${parsedState.userId.slice(0, 8)}...`);
          
          // Check if the state is recent enough (less than 15 minutes old)
          const stateAgeMinutes = (Date.now() - parsedState.timestamp) / (60 * 1000);
          addDebugInfo(`Auth state is ${stateAgeMinutes.toFixed(1)} minutes old`);
          
          if (stateAgeMinutes > 15) {
            addDebugInfo('Auth state is too old, will not use it');
          }
        } catch (e) {
          addDebugInfo(`Error parsing saved auth state: ${e instanceof Error ? e.message : 'Unknown error'}`);
        }
      } else {
        addDebugInfo('No saved auth state found');
      }
      
      // First check if we're already authenticated
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        addDebugInfo(`Already authenticated as ${session.user.email}`);
        setAuthRestoreAttempted(true);
        return;
      }

      const restored = await restoreFacebookAuthState();
      
      if (restored) {
        addDebugInfo('Authentication state restored successfully');
      } else {
        addDebugInfo('Could not restore authentication state, will attempt to continue anyway');
        
        // We might need to redirect back to auth
        if (!session) {
          addDebugInfo('No active session, redirecting to auth page in 5 seconds...');
          setTimeout(() => {
            navigate('/auth', { state: { message: 'Session expired. Please log in again to complete Facebook connection.' } });
          }, 5000);
        }
      }
      
      setAuthRestoreAttempted(true);
    };
    
    restoreAuth();
  }, [navigate]);

  // Then process the Facebook callback once auth restore is attempted
  useEffect(() => {
    if (!authRestoreAttempted) return;
    
    async function handleFacebookCallback() {
      try {
        // Extract code from URL
        const params = new URLSearchParams(location.search);
        const code = params.get('code');
        
        if (!code) {
          throw new Error('Authorization code not found');
        }

        addDebugInfo(`Processing Facebook callback with code: ${code.substring(0, 10)}...`);
        setStatus('processing');

        // Get the current user
        const { data: userData, error: userError } = await supabase.auth.getUser();
        if (userError) {
          addDebugInfo(`Error getting user: ${userError.message}`);
          throw userError;
        }
        
        if (!userData.user) {
          addDebugInfo('User not authenticated');
          throw new Error('User not authenticated');
        }

        addDebugInfo(`Authenticated as user ID: ${userData.user.id}`);

        // Check for pre-stored pages from Facebook login
        let pages: FacebookPage[] = [];
        const storedPagesStr = localStorage.getItem('fb_pages');
        
        if (storedPagesStr) {
          try {
            const storedPages = JSON.parse(storedPagesStr);
            if (Array.isArray(storedPages) && storedPages.length > 0) {
              pages = storedPages;
              addDebugInfo(`Found ${pages.length} pages in local storage`);
            }
          } catch (e) {
            addDebugInfo('Error parsing stored pages: ' + String(e));
          }
        }
        
        // For demonstration, if no pages were found in storage,
        // we'll simulate the FB Graph API call to exchange code for token
        if (pages.length === 0) {
          addDebugInfo('No stored pages found, simulating token exchange...');
          setStatus('exchanging_code');
          
          // In a real implementation, you would make a server-side call to:
          // 1. Exchange the code for a user access token
          // 2. Use the user token to get a list of pages
          // 3. For each page, exchange the page token for a long-lived token
          
          // Simulate API exchange with a delay
          await new Promise(resolve => setTimeout(resolve, 1000));
          
          setStatus('getting_pages');
          addDebugInfo('Simulating getting Facebook pages...');
          
          // Create mock pages - in production, these would come from the FB Graph API
          pages = [
            {
              id: '540380515830720', // This ID should be replaced with your actual page ID
              name: 'Test Business Page',
              access_token: `EAATk...${Math.random().toString(36).substring(2, 10)}`, // Would be real token in production
              category: 'Business'
            }
          ];
          
          addDebugInfo(`Generated ${pages.length} mock pages for demo`);
        }
        
        setAvailablePages(pages);
        
        // If there's only one page, select it automatically
        if (pages.length === 1) {
          setSelectedPageId(pages[0].id);
          
          // Proceed with saving the connection
          await saveConnection(userData.user.id, pages[0]);
        } else if (pages.length > 1) {
          // If multiple pages, let the user select one
          addDebugInfo('Multiple Facebook pages found, waiting for user selection');
          setProcessing(false);
          setStatus('getting_pages');
        } else {
          throw new Error('No Facebook pages found with manage permission');
        }
      } catch (err) {
        console.error('Facebook OAuth Error:', err);
        addDebugInfo(`Facebook OAuth Error: ${err instanceof Error ? err.message : 'Unknown error'}`);
        setError('Failed to connect your Facebook account. Please try again.');
        setStatus('error');
        setProcessing(false);
      }
    }

    handleFacebookCallback();
  }, [location, authRestoreAttempted, navigate]);

  // Function to save the selected page connection
  const saveConnection = async (userId: string, page: FacebookPage) => {
    try {
      setStatus('saving');
      addDebugInfo(`Saving connection for page: ${page.name} (${page.id})`);
      
      // Calculate a 60 day expiry for the token
      const expiryDate = new Date();
      expiryDate.setDate(expiryDate.getDate() + 60);
      
      // Check for existing connection first
      const { data: existingConnections, error: connectionError } = await supabase
        .from('social_connections')
        .select('*')
        .eq('user_id', userId)
        .eq('fb_page_id', page.id);
        
      if (connectionError) {
        addDebugInfo(`Error checking existing connections: ${connectionError.message}`);
        throw connectionError;
      }
      
      if (existingConnections && existingConnections.length > 0) {
        // Update existing connection
        addDebugInfo('Updating existing connection');
        const { error: updateError } = await supabase
          .from('social_connections')
          .update({
            access_token: page.access_token,
            token_expiry: expiryDate.toISOString(),
            refreshed_at: new Date().toISOString()
          })
          .eq('id', existingConnections[0].id);
          
        if (updateError) {
          addDebugInfo(`Error updating connection: ${updateError.message}`);
          throw updateError;
        }
      } else {
        // Create new connection
        addDebugInfo('Creating new Facebook connection');
        const { error: insertError } = await supabase
          .from('social_connections')
          .insert([{
            user_id: userId,
            fb_page_id: page.id, // Store the actual page ID
            access_token: page.access_token, 
            token_expiry: expiryDate.toISOString()
          }]);
          
        if (insertError) {
          addDebugInfo(`Error creating connection: ${insertError.message}`);
          throw insertError;
        }
      }
      
      // Clean up stored pages and auth state
      localStorage.removeItem('fb_pages');
      localStorage.removeItem('fb_auth_state');
      
      addDebugInfo('Facebook page connected successfully');
      setStatus('success');
      
      // Success! Wait a moment then redirect
      setTimeout(() => {
        navigate('/settings', { replace: true });
      }, 2000);
    } catch (error) {
      addDebugInfo(`Error saving connection: ${error instanceof Error ? error.message : String(error)}`);
      setError('Failed to save Facebook connection. Please try again.');
      setStatus('error');
    }
  };

  // Handler for when user selects a page
  const handlePageSelection = async (pageId: string) => {
    const selectedPage = availablePages.find(page => page.id === pageId);
    if (!selectedPage) {
      setError('Selected page not found');
      return;
    }
    
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      setError('User not authenticated');
      return;
    }
    
    await saveConnection(user.id, selectedPage);
  };

  const tryAgain = () => {
    navigate('/settings');
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        <div className="flex justify-center">
          <MessageSquare className="h-12 w-12 text-indigo-600" />
        </div>
        <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900">
          Connecting Facebook
        </h2>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="bg-white py-8 px-4 shadow sm:rounded-lg sm:px-10 text-center">
          {status === 'auth_restore' && (
            <>
              <div className="flex justify-center mb-4">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
              </div>
              <p className="text-gray-700">
                Restoring your authentication...
              </p>
              <p className="text-sm text-gray-500 mt-2">
                Please wait while we complete the Facebook connection.
              </p>
            </>
          )}

          {(status === 'processing' || status === 'exchanging_code' || status === 'saving') && (
            <>
              <div className="flex justify-center mb-4">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
              </div>
              <p className="text-gray-700">
                {status === 'processing' && 'Processing your Facebook connection...'}
                {status === 'exchanging_code' && 'Exchanging authorization code for access token...'}
                {status === 'saving' && 'Saving your Facebook page connection...'}
              </p>
              <p className="text-sm text-gray-500 mt-2">
                This might take a moment.
              </p>
            </>
          )} 
          
          {status === 'getting_pages' && availablePages.length > 0 ? (
            <>
              <h3 className="text-lg font-medium text-gray-900 mb-4">Select a Facebook Page</h3>
              <p className="mb-4 text-sm text-gray-500">Choose which Facebook Page you want to connect to your AI Assistant</p>
              
              <div className="space-y-3 mt-4">
                {availablePages.map(page => (
                  <div 
                    key={page.id} 
                    className={`p-4 border rounded-lg cursor-pointer hover:bg-gray-50 transition-colors ${
                      selectedPageId === page.id ? 'border-indigo-500 bg-indigo-50' : 'border-gray-200'
                    }`}
                    onClick={() => setSelectedPageId(page.id)}
                  >
                    <div className="flex items-center">
                      <div className="flex-shrink-0">
                        <Facebook className="h-6 w-6 text-blue-600" />
                      </div>
                      <div className="ml-3 text-left">
                        <h4 className="text-sm font-medium text-gray-900">{page.name}</h4>
                        <p className="text-xs text-gray-500">{page.category} • ID: {page.id.slice(0, 10)}...</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
              
              <div className="mt-6">
                <button
                  onClick={() => selectedPageId && handlePageSelection(selectedPageId)}
                  disabled={!selectedPageId}
                  className="w-full py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50"
                >
                  Connect Selected Page
                </button>
              </div>
            </>
          ) : status === 'error' ? (
            <>
              <div className="flex justify-center mb-4">
                <AlertCircle className="h-12 w-12 text-red-500" />
              </div>
              <div className="bg-red-50 border border-red-200 text-red-600 px-4 py-3 mb-4 rounded-md text-sm">
                {error}
              </div>
              <div className="space-y-3">
                <button
                  onClick={tryAgain}
                  className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                >
                  Go Back to Settings
                </button>
                
                <p className="text-sm text-gray-500">or</p>
                
                <button
                  onClick={() => {
                    localStorage.removeItem('fb_auth_state');
                    navigate('/auth');
                  }}
                  className="inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                >
                  Start Over with Login
                </button>
              </div>
            </>
          ) : status === 'success' ? (
            <>
              <div className="flex justify-center mb-4">
                <Facebook className="h-12 w-12 text-blue-600" />
              </div>
              <div className="bg-green-50 border border-green-200 text-green-600 px-4 py-3 mb-4 rounded-md text-sm">
                Successfully connected to Facebook!
              </div>
              <p className="text-gray-700 mb-4">Redirecting you back to settings...</p>
            </>
          ) : null}
          
          {/* Debug info section */}
          {debugInfo.length > 0 && (
            <div className="mt-6 p-3 bg-gray-50 rounded-md text-left">
              <p className="text-xs text-gray-500 font-semibold mb-1">Debug Information:</p>
              <div className="text-xs text-gray-500 max-h-40 overflow-y-auto">
                {debugInfo.map((info, idx) => (
                  <div key={idx}>{info}</div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
