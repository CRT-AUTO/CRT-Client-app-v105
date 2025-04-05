import React, { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { restoreFacebookAuthState, exchangeCodeForToken, getLongLivedPageToken } from '../lib/facebookAuth';
import type { FacebookPage } from '../lib/facebookAuth';

export default function FacebookCallback() {
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<'processing' | 'auth_restore' | 'exchanging_code' | 'getting_pages' | 'saving' | 'success' | 'error'>('processing');
  const [debugInfo, setDebugInfo] = useState<string[]>([]);
  const [selectedPageId, setSelectedPageId] = useState<string | null>(null);
  const [availablePages, setAvailablePages] = useState<FacebookPage[]>([]);
  const [authRestoreAttempted, setAuthRestoreAttempted] = useState(false);
  const [currentUser, setCurrentUser] = useState<any>(null);
  const location = useLocation();
  const navigate = useNavigate();

  const addDebugInfo = (message: string) => {
    console.log(message);
    setDebugInfo(prev => [...prev, `${new Date().toISOString().slice(11, 19)}: ${message}`]);
  };

  // Attempt to restore authentication state
  useEffect(() => {
    const restoreAuth = async () => {
      if (authRestoreAttempted) return;
      addDebugInfo('Attempting to restore authentication state');
      setStatus('auth_restore');

      const savedState = localStorage.getItem('fb_auth_state');
      if (savedState) {
        try {
          const parsedState = JSON.parse(savedState);
          addDebugInfo(`Found saved auth state for user ${parsedState.userId.slice(0, 8)}...`);
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
      
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        addDebugInfo(`Already authenticated as ${session.user.email}`);
        setCurrentUser(session.user);
        setAuthRestoreAttempted(true);
        return;
      }
      
      const restored = await restoreFacebookAuthState();
      if (restored) {
        addDebugInfo('Authentication state restored successfully');
        const { data: { session } } = await supabase.auth.getSession();
        if (session) setCurrentUser(session.user);
      } else {
        addDebugInfo('Could not restore authentication state, will attempt to continue anyway');
        if (!session) {
          addDebugInfo('No active session, redirecting to auth page in 5 seconds...');
          setTimeout(() => {
            navigate('/auth', { state: { message: 'Session expired. Please log in again to complete Facebook connection.' } });
          }, 5000);
          return;
        } else {
          setCurrentUser(session.user);
        }
      }
      setAuthRestoreAttempted(true);
    };
    restoreAuth();
  }, [navigate, authRestoreAttempted]);

  // Process the Facebook callback after auth is restored
  useEffect(() => {
    if (!authRestoreAttempted) return;
    async function handleFacebookCallback() {
      try {
        const params = new URLSearchParams(location.search);
        const code = params.get('code');
        if (!code) throw new Error('Authorization code not found');
        addDebugInfo(`Processing Facebook callback with code: ${code.substring(0, 10)}...`);
        setStatus('processing');

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
        setCurrentUser(userData.user);

        // Retrieve any pre-stored Facebook pages
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

        const redirectUri = `https://crt-tech.org/oauth/facebook/callback`;

        // If no pages are found, simulate user token exchange
        if (pages.length === 0) {
          addDebugInfo('No stored pages found, simulating token exchange...');
          setStatus('exchanging_code');
          const userToken = await exchangeCodeForToken(code, redirectUri);
          addDebugInfo(`Exchanged code for user token: ${userToken.substring(0, 10)}...`);
          const tokenExpiry = new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString();
          const { error: updateError } = await supabase
            .from('social_connections')
            .upsert({
              user_id: userData.user.id,
              access_token: userToken,
              token_expiry: tokenExpiry,
            }, { onConflict: 'user_id' });
          if (updateError) {
            throw new Error('Failed to update Facebook token in Supabase: ' + updateError.message);
          }
          addDebugInfo('Facebook user token saved to Supabase');
          setStatus('success');
          localStorage.removeItem('fb_auth_state');
          navigate('/settings');
        }
        // If exactly one page is available, use it automatically
        else if (pages.length === 1) {
          setStatus('getting_pages');
          const selectedPage = pages[0];
          addDebugInfo(`Automatically selected the only page: ${selectedPage.name}`);
          setStatus('exchanging_code');
          const longLivedToken = await getLongLivedPageToken(selectedPage.access_token, selectedPage.id);
          addDebugInfo(`Obtained long lived token for page ${selectedPage.name}: ${longLivedToken.substring(0, 10)}...`);
          const tokenExpiry = new Date(Date.now() + 60 * 24 * 60 * 60 * 1000).toISOString();
          const { error: updateError } = await supabase
            .from('social_connections')
            .upsert({
              user_id: userData.user.id,
              fb_page_id: selectedPage.id,
              access_token: longLivedToken,
              token_expiry: tokenExpiry,
            }, { onConflict: 'user_id' });
          if (updateError) {
            throw new Error('Failed to update Facebook page token in Supabase: ' + updateError.message);
          }
          addDebugInfo(`Facebook page ${selectedPage.name} connected and token saved to Supabase`);
          setStatus('success');
          localStorage.removeItem('fb_pages');
          navigate('/settings');
        }
        // If multiple pages are found, prompt the user to select one
        else {
          setStatus('getting_pages');
          setAvailablePages(pages);
          addDebugInfo('Multiple pages found. Awaiting user selection.');
        }
      } catch (err) {
        console.error('Error processing Facebook callback:', err);
        addDebugInfo(`Error: ${err instanceof Error ? err.message : 'Unknown error'}`);
        setError(err instanceof Error ? err.message : 'An error occurred during Facebook connection');
        setStatus('error');
      }
    }
    handleFacebookCallback();
  }, [authRestoreAttempted, location.search, navigate]);

  // Process user-selected page (if multiple pages are available)
  useEffect(() => {
    async function processSelectedPage() {
      if (selectedPageId && availablePages.length > 0 && currentUser) {
        const selectedPage = availablePages.find(p => p.id === selectedPageId);
        if (!selectedPage) {
          addDebugInfo('Selected page not found in available pages');
          return;
        }
        setStatus('exchanging_code');
        const longLivedToken = await getLongLivedPageToken(selectedPage.access_token, selectedPage.id);
        addDebugInfo(`Obtained long lived token for page ${selectedPage.name}: ${longLivedToken.substring(0, 10)}...`);
        const tokenExpiry = new Date(Date.now() + 60 * 24 * 60 * 60 * 1000).toISOString();
        const { error: updateError } = await supabase
          .from('social_connections')
          .upsert({
            user_id: currentUser.id,
            fb_page_id: selectedPage.id,
            access_token: longLivedToken,
            token_expiry: tokenExpiry,
          }, { onConflict: 'user_id' });
        if (updateError) {
          addDebugInfo('Error updating Supabase: ' + updateError.message);
          setError('Failed to update Facebook page token in Supabase');
          setStatus('error');
          return;
        }
        addDebugInfo(`Facebook page ${selectedPage.name} connected and token saved to Supabase`);
        setStatus('success');
        localStorage.removeItem('fb_pages');
        navigate('/settings');
      }
    }
    processSelectedPage();
  }, [selectedPageId, availablePages, currentUser, navigate]);

  // Render page selection UI if multiple pages are available and no page is selected yet
  if (status === 'getting_pages' && availablePages.length > 1 && !selectedPageId) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center">
        <h2 className="text-xl font-bold mb-4">Select a Facebook Page</h2>
        <ul>
          {availablePages.map(page => (
            <li key={page.id} className="mb-2">
              <button 
                onClick={() => setSelectedPageId(page.id)}
                className="px-4 py-2 bg-blue-600 text-white rounded"
              >
                {page.name}
              </button>
            </li>
          ))}
        </ul>
        {debugInfo.length > 0 && (
          <div className="mt-4 p-2 border rounded bg-gray-100">
            <h3 className="text-sm font-bold">Debug Info:</h3>
            <ul>
              {debugInfo.map((info, idx) => (
                <li key={idx} className="text-xs">{info}</li>
              ))}
            </ul>
          </div>
        )}
      </div>
    );
  }

  // Default rendering: loading/error/success states
  return (
    <div className="min-h-screen flex flex-col items-center justify-center">
      {status === 'processing' || status === 'exchanging_code' ? (
        <div>
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gray-900 mb-4"></div>
          <p>{status === 'processing' ? 'Processing...' : 'Exchanging code for token...'}</p>
        </div>
      ) : status === 'success' ? (
        <div>
          <p>Facebook connection successful! Redirecting...</p>
        </div>
      ) : status === 'error' ? (
        <div>
          <p className="text-red-600">Error: {error}</p>
        </div>
      ) : (
        <div>
          <p>Loading...</p>
        </div>
      )}
      {debugInfo.length > 0 && (
        <div className="mt-4 p-2 border rounded bg-gray-100">
          <h3 className="text-sm font-bold">Debug Info:</h3>
          <ul>
            {debugInfo.map((info, idx) => (
              <li key={idx} className="text-xs">{info}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
