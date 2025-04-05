import { useState, useEffect } from 'react';
import { captureError } from './sentry';

// Custom hook for error handling with automatic retry
export function useAsyncCall<T>(
  asyncFunction: (...args: any[]) => Promise<T>,
  initialState: T,
  maxRetries = 3,
  retryDelay = 1000
) {
  const [data, setData] = useState<T>(initialState);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [retryCount, setRetryCount] = useState(0);

  const execute = async (...args: any[]) => {
    setLoading(true);
    setError(null);
    
    try {
      const result = await asyncFunction(...args);
      setData(result);
      setLoading(false);
      setRetryCount(0); // Reset retry count on success
      return result;
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));
      console.error('Error in async call:', error);
      
      // If we haven't exceeded max retries, try again
      if (retryCount < maxRetries) {
        setRetryCount(prevCount => prevCount + 1);
        console.log(`Retrying (${retryCount + 1}/${maxRetries})...`);
        
        // Wait before retrying
        await new Promise(resolve => setTimeout(resolve, retryDelay));
        
        // Try again
        return execute(...args);
      }
      
      // Max retries exceeded, set error and report to Sentry in production
      setError(error);
      captureError(error, { context: 'useAsyncCall', args });
      setLoading(false);
      throw error;
    }
  };

  const reset = () => {
    setData(initialState);
    setLoading(false);
    setError(null);
    setRetryCount(0);
  };

  return { data, loading, error, execute, reset };
}

// Error boundary fallback component type
export interface ErrorFallbackProps {
  error: Error;
  resetErrorBoundary: () => void;
}

// Helper function to get user-friendly error messages
export function getUserFriendlyErrorMessage(error: Error): string {
  const message = error.message;
  
  // Network connectivity issues
  if (message.includes('network') || message.includes('Network Error') || 
      message.includes('Failed to fetch') || message.includes('fetch failed')) {
    return 'Network connection error. Please check your internet connection and try again.';
  }
  
  if (message.includes('timeout') || message.includes('timed out')) {
    return 'The request took too long to complete. Please try again.';
  }
  
  if (message.includes('rate limit') || message.includes('too many requests')) {
    return 'You have made too many requests. Please wait a moment and try again.';
  }
  
  if (message.includes('not authenticated') || message.includes('unauthorized') || 
      message.includes('No API key found')) {
    return 'Authentication error. Please sign out and sign in again.';
  }
  
  if (message.includes('permission') || message.includes('forbidden')) {
    return 'You do not have permission to perform this action.';
  }
  
  // Default message
  return 'An unexpected error occurred. Please try again later.';
}

// Check if the error is a network error
export function isNetworkError(error: any): boolean {
  if (!error) return false;
  
  // Extract error message, handling different error object structures
  const errorMessage = typeof error === 'string' 
    ? error 
    : error.message || error.error?.message || JSON.stringify(error);
  
  return (
    errorMessage.includes('Failed to fetch') ||
    errorMessage.includes('Network Error') ||
    errorMessage.includes('network request failed') ||
    errorMessage.includes('NetworkError') ||
    errorMessage.includes('ECONNREFUSED') ||
    errorMessage.includes('Network error') ||
    errorMessage.includes('fetch failed') ||
    (error.name === 'TypeError' && errorMessage.includes('fetch')) ||
    (error.name === 'TypeError' && errorMessage.includes('network')) ||
    (error.code === 'NETWORK_ERROR') ||
    (error.status && error.status === 0) ||
    (error.statusCode && error.statusCode === 0)
  );
}

// Generic error handling for API calls
export async function withErrorHandling<T>(
  apiCall: () => Promise<T>,
  fallbackValue: T,
  customErrorMessage?: string
): Promise<T> {
  try {
    return await apiCall();
  } catch (error) {
    console.error('API Error:', error);
    
    // Report to Sentry in production
    captureError(error, { 
      context: 'withErrorHandling',
      customErrorMessage 
    });
    
    if (customErrorMessage) {
      console.error(customErrorMessage);
    }
    
    return fallbackValue;
  }
}

// Debounce function for API calls
export function debounce<T extends (...args: any[]) => any>(
  func: T,
  wait: number
): (...args: Parameters<T>) => void {
  let timeout: ReturnType<typeof setTimeout> | null = null;
  
  return function(...args: Parameters<T>): void {
    const later = () => {
      timeout = null;
      func(...args);
    };
    
    if (timeout !== null) {
      clearTimeout(timeout);
    }
    timeout = setTimeout(later, wait);
  };
}

// Custom hook for handling loading states with timeout detection
export function useLoadingWithTimeout(timeout = 10000) {
  const [loading, setLoading] = useState(false);
  const [timedOut, setTimedOut] = useState(false);
  
  useEffect(() => {
    let timeoutId: ReturnType<typeof setTimeout>;
    
    if (loading) {
      setTimedOut(false);
      timeoutId = setTimeout(() => {
        setTimedOut(true);
      }, timeout);
    }
    
    return () => {
      if (timeoutId) clearTimeout(timeoutId);
    };
  }, [loading, timeout]);
  
  return { loading, setLoading, timedOut };
}

// Custom hook for checking network status
export function useNetworkStatus() {
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  
  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);
  
  return isOnline;
}

// Function to retry a network request with exponential backoff
export async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  options: {
    maxRetries?: number;
    initialDelay?: number;
    backoffFactor?: number;
    maxDelay?: number;
    shouldRetry?: (error: any) => boolean;
  } = {}
): Promise<T> {
  const {
    maxRetries = 3,
    initialDelay = 1000,
    backoffFactor = 2,
    maxDelay = 10000,
    shouldRetry = isNetworkError
  } = options;
  
  let lastError: any;
  
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      
      if (attempt === maxRetries || !shouldRetry(error)) {
        throw error;
      }
      
      // Calculate delay with jitter to prevent all clients retrying at once
      const jitter = 0.2 * Math.random() - 0.1; // ±10% jitter
      const calculatedDelay = Math.min(
        maxDelay,
        initialDelay * Math.pow(backoffFactor, attempt) * (1 + jitter)
      );
      
      console.log(`Retrying after network error (attempt ${attempt + 1}/${maxRetries}), waiting ${calculatedDelay.toFixed(0)}ms`);
      
      await new Promise(resolve => setTimeout(resolve, calculatedDelay));
    }
  }
  
  throw lastError;
}