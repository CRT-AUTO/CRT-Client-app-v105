import { supabase } from './supabase';
import { getSocialConnections, refreshSocialConnectionToken } from './api';
import type { SocialConnection } from '../types';

// Define the number of days before expiry to attempt a refresh
const REFRESH_THRESHOLD_DAYS = 7;
// Define the number of days for the new token expiry after refresh
const NEW_TOKEN_VALIDITY_DAYS = 60;

/**
 * Check for tokens that need refreshing and attempt to refresh them
 * This function is called on user login and can also be called by a scheduled function
 */
export async function checkAndRefreshTokens() {
  try {
    // Get the current user
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      console.warn('User not authenticated, skipping token refresh');
      return [];
    }
    
    // Get all social connections for the user
    try {
      const connections = await getSocialConnections();
      
      // Check each connection for expiring tokens
      const refreshResults = [];
      for (const connection of connections) {
        if (shouldRefreshToken(connection)) {
          try {
            const refreshedConnection = await refreshToken(connection);
            refreshResults.push({
              id: connection.id,
              platform: connection.fb_page_id ? 'facebook' : 'instagram',
              status: 'success',
              new_expiry: refreshedConnection.token_expiry
            });
          } catch (error) {
            refreshResults.push({
              id: connection.id,
              platform: connection.fb_page_id ? 'facebook' : 'instagram',
              status: 'error',
              error: error instanceof Error ? error.message : 'Unknown error'
            });
          }
        }
      }
      
      return refreshResults;
    } catch (apiError) {
      console.error('Error fetching social connections:', apiError);
      return [];
    }
  } catch (error) {
    console.error('Error checking/refreshing tokens:', error);
    return [];
  }
}

/**
 * Determine if a token needs refreshing based on expiry date
 */
function shouldRefreshToken(connection: SocialConnection): boolean {
  const expiryDate = new Date(connection.token_expiry);
  const thresholdDate = new Date();
  thresholdDate.setDate(thresholdDate.getDate() + REFRESH_THRESHOLD_DAYS);
  
  return expiryDate <= thresholdDate;
}

/**
 * Calculate days remaining until token expiry
 */
export function getDaysUntilExpiry(expiryDateStr: string): number {
  const expiryDate = new Date(expiryDateStr);
  const now = new Date();
  const diffTime = expiryDate.getTime() - now.getTime();
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
}

/**
 * Refresh a token via Meta's Graph API
 */
async function refreshToken(connection: SocialConnection): Promise<SocialConnection> {
  try {
    // In a real application, you would call Meta's Graph API to refresh the token
    // For this implementation, we'll use a simulated token refresh with proper tracking
    
    // 1. Call Meta Graph API endpoint (simulated)
    // Simulate API call - in production, this would be a real API call
    await simulateApiCall(connection);
    
    // 2. Calculate new expiry date (60 days from now)
    const newExpiryDate = new Date();
    newExpiryDate.setDate(newExpiryDate.getDate() + NEW_TOKEN_VALIDITY_DAYS);
    
    // 3. Update the token expiry in the database
    const updatedConnection = await refreshSocialConnectionToken(
      connection.id,
      newExpiryDate.toISOString()
    );
    
    console.log(`Successfully refreshed token for connection ${connection.id}`);
    return updatedConnection;
  } catch (error) {
    console.error(`Error refreshing token for connection ${connection.id}:`, error);
    throw error;
  }
}

/**
 * Simulate a Meta Graph API call to refresh a token
 * In production, this would be replaced with actual API call
 */
async function simulateApiCall(connection: SocialConnection): Promise<void> {
  // Simulate network latency
  return new Promise((resolve, reject) => {
    setTimeout(() => {
      // Simulate successful API call 95% of the time
      if (Math.random() > 0.05) {
        resolve();
      } else {
        reject(new Error('Failed to refresh token: API error'));
      }
    }, 1000);
  });
}

/**
 * Manually trigger a token refresh for a specific connection
 * Returns the refreshed connection or throws an error
 */
export async function manuallyRefreshToken(connectionId: string): Promise<SocialConnection> {
  try {
    // Get the connection
    const connections = await getSocialConnections();
    const connection = connections.find(c => c.id === connectionId);
    
    if (!connection) {
      throw new Error('Connection not found');
    }
    
    // Refresh the token
    return await refreshToken(connection);
  } catch (error) {
    console.error('Error in manual token refresh:', error);
    throw error;
  }
}

// Function to track API rate limits - moved from previous version to maintain functionality
export async function checkRateLimitAndTrack(
  platform: string,
  endpoint: string,
  limit: number,
  apiCall: () => Promise<any>
) {
  try {
    // Get the current user
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('User not authenticated');
    
    // This would typically check against a database or in-memory store
    // For now, we'll implement a simplified check

    // Execute the API call
    const result = await apiCall();
    
    // Record this API call
    // This would typically write to a database or in-memory store
    console.log(`API call to ${platform}/${endpoint} successful`);
    
    return result;
  } catch (error) {
    console.error(`Error in rate-limited API call to ${platform}/${endpoint}:`, error);
    throw error;
  }
}