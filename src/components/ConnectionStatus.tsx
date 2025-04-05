import React, { useState, useEffect, useCallback } from 'react';
import { Wifi, WifiOff, RefreshCw, AlertTriangle } from 'lucide-react';
import { supabase, checkSupabaseDB } from '../lib/supabase';

interface ConnectionStatusProps {
  onRetry: () => void;
}

const ConnectionStatus: React.FC<ConnectionStatusProps> = ({ onRetry }) => {
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [supabaseStatus, setSupabaseStatus] = useState<'checking' | 'connected' | 'disconnected'>('checking');
  const [lastChecked, setLastChecked] = useState<string>('');
  const [checkCount, setCheckCount] = useState(0);
  const [errorMessage, setErrorMessage] = useState<string>('');
  const [debugInfo, setDebugInfo] = useState<string[]>([]);
  const [retryAttempts, setRetryAttempts] = useState(0);
  const [showDebug, setShowDebug] = useState(false);
  const [consecutiveFailures, setConsecutiveFailures] = useState(0);
  
  const addDebugInfo = (message: string) => {
    console.log(`Connection check: ${message}`);
    setDebugInfo(prev => [...prev.slice(-9), message]);
  };

  // Check online status
  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      // Reset retry count when we go back online to allow immediate connection check
      setRetryAttempts(0);
    };
    const handleOffline = () => setIsOnline(false);
    
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);
  
  // Function to check Supabase connection with proper error handling
  const checkSupabaseConnection = useCallback(async (silent = false) => {
    if (!isOnline) {
      setSupabaseStatus('disconnected');
      setErrorMessage('Your device is offline');
      if (!silent) addDebugInfo('Network offline, skipping Supabase check');
      return;
    }
    
    try {
      if (!silent) {
        setSupabaseStatus('checking');
        addDebugInfo('Checking Supabase connection...');
      }
      
      // Try with ping RPC first
      try {
        const { data, error } = await supabase.rpc('ping');
        
        if (!error) {
          setSupabaseStatus('connected');
          setErrorMessage('');
          setRetryAttempts(0); // Reset retry attempts on success
          setConsecutiveFailures(0); // Reset failure counter
          if (!silent) addDebugInfo('Ping test succeeded');
          return;
        } else {
          if (!silent) addDebugInfo(`Ping error: ${error.message}`);
        }
      } catch (rpcError) {
        if (!silent) addDebugInfo(`Ping RPC failed: ${rpcError instanceof Error ? rpcError.message : 'Unknown error'}`);
        if (!silent) addDebugInfo('Trying DB check');
        
        try {
          const result = await checkSupabaseDB();
          if (result.success) {
            if (!silent) addDebugInfo('DB check succeeded');
            setSupabaseStatus('connected');
            setErrorMessage('');
            setRetryAttempts(0); // Reset retry attempts on success
            setConsecutiveFailures(0); // Reset failure counter
            return;
          } else {
            if (!silent) addDebugInfo(`DB check failed: ${result.error || 'Unknown error'}`);
            setSupabaseStatus('disconnected');
            setErrorMessage(result.error || 'Cannot connect to the database');
            setConsecutiveFailures(prev => prev + 1);
          }
        } catch (dbCheckError) {
          const errorMsg = dbCheckError instanceof Error ? dbCheckError.message : 'Unknown error';
          if (!silent) addDebugInfo(`DB check error: ${errorMsg}`);
          
          setSupabaseStatus('disconnected');
          setConsecutiveFailures(prev => prev + 1);
          
          // Set a user-friendly error message based on the error
          if (errorMsg.includes('timeout')) {
            setErrorMessage('The server is taking too long to respond');
          } else if (errorMsg.includes('Failed to fetch') || errorMsg.includes('Unable to reach')) {
            setErrorMessage('Cannot connect to the Supabase server');
          } else {
            setErrorMessage(errorMsg);
          }
        }
      }
      
      // Fallback to a simple auth check
      try {
        if (!silent) addDebugInfo('Trying session check as last resort');
        const { data, error } = await supabase.auth.getSession();
        if (error) {
          if (!silent) addDebugInfo(`Session check error: ${error.message}`);
          setSupabaseStatus('disconnected');
          setConsecutiveFailures(prev => prev + 1);
        } else if (data.session) {
          if (!silent) addDebugInfo('Session check completed successfully');
          setSupabaseStatus('connected');
          setErrorMessage('');
          setRetryAttempts(0); // Reset retry attempts on success
          setConsecutiveFailures(0); // Reset failure counter
        } else {
          if (!silent) addDebugInfo('No session found, but API is responding');
          setSupabaseStatus('connected');
          setErrorMessage('');
          setRetryAttempts(0); // Reset retry attempts on success
          setConsecutiveFailures(0); // Reset failure counter
        }
      } catch (authError) {
        if (!silent) addDebugInfo(`Session check error: ${authError instanceof Error ? authError.message : 'Unknown error'}`);
        setSupabaseStatus('disconnected');
        setConsecutiveFailures(prev => prev + 1);
      }
      
      // Update last checked time
      const now = new Date();
      setLastChecked(now.toLocaleTimeString());
      setCheckCount(prev => prev + 1);
      
    } catch (error) {
      console.error('Error checking Supabase connection:', error);
      if (!silent) addDebugInfo(`Connection check error: ${error instanceof Error ? error.message : 'Unknown error'}`);
      setSupabaseStatus('disconnected');
      setErrorMessage('Unable to check connection status');
      setConsecutiveFailures(prev => prev + 1);
    }
  }, [isOnline]);
  
  // Handle manual retry
  const handleRetry = useCallback(() => {
    // Reset error message
    setErrorMessage('');
    // Reset retry attempts to force an immediate check
    setRetryAttempts(0);
    setConsecutiveFailures(0);
    // Trigger the retry function from props
    onRetry();
    // Then check connection again
    checkSupabaseConnection();
  }, [checkSupabaseConnection, onRetry]);
  
  // Check connection on initial load and when network status changes
  useEffect(() => {
    // Initial check
    checkSupabaseConnection();
    
    // Check connection periodically with exponential backoff
    // Start with higher delay (30 seconds), then increase exponentially with each retry
    const getRetryDelay = () => {
      // Base delay is 30 seconds
      const baseDelay = 30000; // Increased from 5000 to reduce frequency
      // Max delay is 5 minutes
      const maxDelay = 300000; // 5 minutes
      
      if (retryAttempts === 0) return baseDelay;
      
      // Calculate exponential backoff: baseDelay * 2^retryAttempts
      const delay = Math.min(
        baseDelay * Math.pow(2, retryAttempts),
        maxDelay
      );
      
      // Add a small random jitter to prevent all clients from retrying simultaneously
      return delay + (Math.random() * 1000);
    };
    
    // Only set up interval check if we're online
    if (isOnline) {
      const delay = getRetryDelay();
      console.log(`Setting up next connection check in ${Math.round(delay/1000)} seconds`);
      
      const intervalId = setTimeout(() => {
        // Use silent check most of the time to avoid flooding debug logs
        const useSilentCheck = retryAttempts > 0 || checkCount > 2;
        checkSupabaseConnection(useSilentCheck);
        setRetryAttempts(prev => prev + 1);
      }, delay);
      
      return () => clearTimeout(intervalId);
    }
  }, [checkSupabaseConnection, retryAttempts, isOnline, checkCount]);
  
  // Only show the UI when offline or definitely disconnected (after multiple failed attempts)
  const shouldShowUI = !isOnline || (supabaseStatus === 'disconnected' && consecutiveFailures >= 2);
  
  // Don't show anything when everything is working
  if (!shouldShowUI) {
    return null;
  }
  
  return (
    <div className="fixed top-0 left-0 right-0 p-3 bg-red-500 text-white z-50">
      <div className="flex items-center justify-center">
        {!isOnline ? (
          <>
            <WifiOff className="h-5 w-5 mr-2" />
            <span>You are currently offline. Please check your internet connection.</span>
          </>
        ) : supabaseStatus === 'disconnected' ? (
          <>
            <AlertTriangle className="h-5 w-5 mr-2" />
            <span>{errorMessage || 'Unable to connect to the server. Some features may not work correctly.'}</span>
            <span className="ml-2 text-xs opacity-75">Last checked: {lastChecked}</span>
          </>
        ) : (
          <>
            <div className="animate-spin rounded-full h-4 w-4 border-2 border-white mr-2"></div>
            <span>Checking connection...</span>
          </>
        )}
        <button
          onClick={handleRetry}
          className="ml-4 inline-flex items-center px-3 py-1 bg-white bg-opacity-20 rounded text-white text-sm hover:bg-opacity-30"
        >
          <RefreshCw className="h-4 w-4 mr-1" />
          Retry
        </button>
        <button 
          onClick={() => setShowDebug(!showDebug)} 
          className="ml-2 text-xs text-white underline"
        >
          {showDebug ? "Hide Debug" : "Debug"}
        </button>
      </div>
      
      {/* Debug information section - only shown when requested */}
      {showDebug && (
        <div className="mt-2 text-xs border-t border-white border-opacity-20 pt-2">
          <div className="flex flex-wrap justify-center">
            {debugInfo.map((info, i) => (
              <div key={i} className="mr-2 mb-1 bg-white bg-opacity-10 px-2 py-1 rounded">
                {info}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default ConnectionStatus;