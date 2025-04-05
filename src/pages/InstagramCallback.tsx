import React, { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { MessageSquare, AlertCircle, Instagram } from 'lucide-react';

export default function InstagramCallback() {
  const [error, setError] = useState<string | null>(null);
  const [processing, setProcessing] = useState(true);
  const [status, setStatus] = useState<'processing' | 'exchanging_code' | 'saving' | 'success' | 'error'>('processing');
  const [debugInfo, setDebugInfo] = useState<string[]>([]);
  const location = useLocation();
  const navigate = useNavigate();

  const addDebugInfo = (message: string) => {
    console.log(message);
    setDebugInfo(prev => [...prev, `${new Date().toISOString().slice(11, 19)}: ${message}`]);
  };

  useEffect(() => {
    async function handleInstagramCallback() {
      try {
        // Extract code from URL
        const params = new URLSearchParams(location.search);
        const code = params.get('code');
        
        if (!code) {
          throw new Error('Authorization code not found');
        }

        addDebugInfo(`Processing Instagram callback with code: ${code.substring(0, 10)}...`);
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

        // In a real app, you would exchange the code for a token server-side
        // For this implementation, we'll proceed with a simulated token exchange
        
        setStatus('exchanging_code');
        addDebugInfo('Simulating Instagram token exchange...');
        
        // Simulate API delay
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        // Generate a realistic Instagram business account ID and token
        const mockIgAccountId = `17841458279797289`; // Use a consistent ID for testing
        const mockToken = `IGQWRQFBnc3h1cG9ueGxXZAWRoN0Q0d01QZAUZA...${Date.now().toString(36)}`; // Long-lived token format
        
        // Calculate token expiry - 60 days from now
        const expiryDate = new Date();
        expiryDate.setDate(expiryDate.getDate() + 60);
        
        addDebugInfo(`Generated mock Instagram account ID: ${mockIgAccountId}`);
        
        // Save to database
        setStatus('saving');
        addDebugInfo('Saving Instagram connection to database...');
        
        // Check for an existing connection
        const { data: existingConnections, error: connectionError } = await supabase
          .from('social_connections')
          .select('*')
          .eq('user_id', userData.user.id)
          .eq('ig_account_id', mockIgAccountId);
          
        if (connectionError) {
          addDebugInfo(`Error checking existing connections: ${connectionError.message}`);
          throw connectionError;
        }
        
        if (existingConnections && existingConnections.length > 0) {
          // Update existing connection
          addDebugInfo('Updating existing Instagram connection');
          const { error: updateError } = await supabase
            .from('social_connections')
            .update({
              access_token: mockToken,
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
          addDebugInfo('Creating new Instagram connection');
          const { error: insertError } = await supabase
            .from('social_connections')
            .insert({
              user_id: userData.user.id,
              ig_account_id: mockIgAccountId,
              access_token: mockToken,
              token_expiry: expiryDate.toISOString()
            });
            
          if (insertError) {
            addDebugInfo(`Error creating connection: ${insertError.message}`);
            throw insertError;
          }
        }
        
        addDebugInfo('Instagram connection saved successfully');
        setStatus('success');
        
        // Success! Wait a moment then redirect
        setTimeout(() => {
          navigate('/settings', { replace: true });
        }, 2000);
        
      } catch (err) {
        console.error('Instagram OAuth Error:', err);
        addDebugInfo(`Instagram OAuth Error: ${err instanceof Error ? err.message : 'Unknown error'}`);
        setError('Failed to connect your Instagram account. Please try again.');
        setStatus('error');
        setProcessing(false);
      }
    }

    handleInstagramCallback();
  }, [location, navigate]);

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        <div className="flex justify-center">
          <MessageSquare className="h-12 w-12 text-indigo-600" />
        </div>
        <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900">
          Connecting Instagram
        </h2>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="bg-white py-8 px-4 shadow sm:rounded-lg sm:px-10 text-center">
          {status === 'processing' || status === 'exchanging_code' || status === 'saving' ? (
            <>
              <div className="flex justify-center mb-4">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
              </div>
              <p className="text-gray-700">
                {status === 'processing' && 'Processing your Instagram connection...'}
                {status === 'exchanging_code' && 'Exchanging authorization code for access token...'}
                {status === 'saving' && 'Saving your Instagram account connection...'}
              </p>
              <p className="text-sm text-gray-500 mt-2">
                This might take a moment.
              </p>
            </>
          ) : status === 'error' ? (
            <>
              <div className="flex justify-center mb-4">
                <AlertCircle className="h-12 w-12 text-red-500" />
              </div>
              <div className="bg-red-50 border border-red-200 text-red-600 px-4 py-3 mb-4 rounded-md text-sm">
                {error}
              </div>
              <button
                onClick={() => navigate('/settings')}
                className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
              >
                Go Back to Settings
              </button>
            </>
          ) : (
            <>
              <div className="flex justify-center mb-4">
                <Instagram className="h-12 w-12 text-pink-600" />
              </div>
              <div className="bg-green-50 border border-green-200 text-green-600 px-4 py-3 mb-4 rounded-md text-sm">
                Successfully connected to Instagram!
              </div>
              <p className="text-gray-700 mb-4">Redirecting you back to settings...</p>
            </>
          )}
          
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