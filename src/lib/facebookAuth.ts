import { supabase } from './supabase';

// Type definitions for Facebook responses
export interface FacebookAuthResponse {
  accessToken: string;
  expiresIn: number;
  signedRequest: string;
  userID: string;
}

export interface FacebookStatusResponse {
  status: 'connected' | 'not_authorized' | 'unknown' | 'error';
  authResponse: FacebookAuthResponse | null;
}

export interface FacebookPage {
  id: string;
  name: string;
  access_token: string;
  category: string;
  tasks: string[];
}

// Function to check Facebook login status
export function checkFacebookLoginStatus(): Promise<FacebookStatusResponse> {
  return new Promise((resolve, reject) => {
    // Make sure FB SDK is loaded
    if (typeof FB === 'undefined') {
      console.error('Facebook SDK not loaded');
      resolve({ status: 'error', authResponse: null });
      return;
    }

    FB.getLoginStatus((response) => {
      console.log('Facebook login status:', response);
      resolve(response as FacebookStatusResponse);
    });
  });
}

// The callback function that will be called from checkLoginState
export function statusChangeCallback(response: FacebookStatusResponse): Promise<boolean> {
  return handleFacebookStatusChange(response);
}

// Handle status change
export function handleFacebookStatusChange(response: FacebookStatusResponse): Promise<boolean> {
  return new Promise(async (resolve) => {
    if (response.status === 'connected' && response.authResponse) {
      // User is logged in to Facebook and has authorized the app
      console.log('Connected to Facebook, authorized app');
      
      try {
        // Get the Facebook access token and user ID
        const fbToken = response.authResponse.accessToken;
        const userId = response.authResponse.userID;
        
        console.log('Facebook auth response:', {
          token: fbToken ? `${fbToken.substring(0, 10)}...` : 'missing',
          userId,
          expiresIn: response.authResponse.expiresIn
        });
        
        // Get additional user information from Facebook
        try {
          const userInfo = await getFacebookUserInfo(userId, fbToken);
          console.log('Facebook user info:', userInfo);
        } catch (userInfoError) {
          console.warn('Could not get Facebook user info:', userInfoError);
          // Continue anyway
        }
        
        // Get user's Facebook pages
        try {
          const pages = await getFacebookPages(fbToken);
          console.log('Facebook pages:', pages);
          
          if (pages && pages.length > 0) {
            // Store pages in localStorage for the callback to use
            localStorage.setItem('fb_pages', JSON.stringify(pages));
          }
        } catch (pagesError) {
          console.warn('Could not get Facebook pages:', pagesError);
          // Continue anyway
        }
        
        // Initiate the Facebook OAuth flow
        const appId = import.meta.env.VITE_META_APP_ID;
        const redirectUri = `${window.location.origin}/oauth/facebook/callback`;
        
        if (!appId) {
          console.error('Facebook App ID is not configured');
          resolve(false);
          return;
        }
        
        // Redirect to Facebook OAuth dialog with code response type
        // Code response type is required for server-side token exchange
        const oauthUrl = `https://www.facebook.com/v18.0/dialog/oauth?client_id=${appId}&redirect_uri=${encodeURIComponent(redirectUri)}&response_type=code&scope=public_profile,email,pages_show_list,pages_messaging`;
        
        console.log('Redirecting to Facebook OAuth:', oauthUrl);
        window.location.href = oauthUrl;
        
        resolve(true);
      } catch (error) {
        console.error('Error handling Facebook login:', error);
        resolve(false);
      }
    } else if (response.status === 'not_authorized') {
      // User is logged into Facebook but has not authorized the app
      console.log('Not authorized: User is logged into Facebook but has not authorized the app');
      
      // Redirect to Facebook OAuth dialog
      const appId = import.meta.env.VITE_META_APP_ID;
      const redirectUri = `${window.location.origin}/oauth/facebook/callback`;
      
      if (!appId) {
        console.error('Facebook App ID is not configured');
        resolve(false);
        return;
      }
      
      window.location.href = `https://www.facebook.com/v18.0/dialog/oauth?client_id=${appId}&redirect_uri=${encodeURIComponent(redirectUri)}&scope=public_profile,email,pages_show_list,pages_messaging&response_type=code`;
      
      resolve(false);
    } else {
      // User is not logged into Facebook
      console.log('User is not logged into Facebook, initiating OAuth flow');
      
      // Redirect to Facebook login
      const appId = import.meta.env.VITE_META_APP_ID;
      const redirectUri = `${window.location.origin}/oauth/facebook/callback`;
      
      if (!appId) {
        console.error('Facebook App ID is not configured');
        resolve(false);
        return;
      }
      
      window.location.href = `https://www.facebook.com/v18.0/dialog/oauth?client_id=${appId}&redirect_uri=${encodeURIComponent(redirectUri)}&scope=public_profile,email,pages_show_list,pages_messaging&response_type=code`;
      
      resolve(false);
    }
  });
}

// Function to check login state - follows Facebook's documentation pattern
export function checkLoginState() {
  if (typeof FB === 'undefined') {
    console.error('Facebook SDK not loaded when checking login state');
    return;
  }
  
  FB.getLoginStatus(function(response: FacebookStatusResponse) {
    statusChangeCallback(response);
  });
}

// Function to initiate Facebook login
export function loginWithFacebook(): Promise<FacebookStatusResponse> {
  return new Promise((resolve, reject) => {
    if (typeof FB === 'undefined') {
      // If FB SDK is not loaded, redirect directly to the OAuth flow
      const appId = import.meta.env.VITE_META_APP_ID;
      const redirectUri = `${window.location.origin}/oauth/facebook/callback`;
      
      if (!appId) {
        reject(new Error('Facebook App ID is not configured'));
        return;
      }
      
      window.location.href = `https://www.facebook.com/v18.0/dialog/oauth?client_id=${appId}&redirect_uri=${encodeURIComponent(redirectUri)}&response_type=code&scope=public_profile,email,pages_show_list,pages_messaging`;
      reject(new Error('Facebook SDK not loaded, redirecting to OAuth flow'));
      return;
    }

    FB.login((response) => {
      console.log("Facebook login response:", response);
      if (response.status === 'connected') {
        // Successful login, resolve with the response
        resolve(response as FacebookStatusResponse);
      } else {
        // Login was not successful
        console.log("Facebook login was not successful:", response);
        resolve(response as FacebookStatusResponse);
      }
    }, { scope: 'public_profile,email,pages_show_list,pages_messaging', auth_type: 'rerequest' });
  });
}

// Get user information from Facebook
export function getFacebookUserInfo(userId: string, accessToken: string): Promise<any> {
  return new Promise((resolve, reject) => {
    if (typeof FB === 'undefined') {
      reject(new Error('Facebook SDK not loaded'));
      return;
    }
    
    FB.api(
      `/${userId}`,
      'GET',
      { fields: 'id,name,email', access_token: accessToken },
      (response: any) => {
        if (!response || response.error) {
          reject(response?.error || new Error('Failed to get user info'));
          return;
        }
        resolve(response);
      }
    );
  });
}

// Get Facebook pages
export function getFacebookPages(accessToken: string): Promise<FacebookPage[]> {
  return new Promise((resolve, reject) => {
    if (typeof FB === 'undefined') {
      reject(new Error('Facebook SDK not loaded'));
      return;
    }
    
    FB.api(
      '/me/accounts',
      'GET',
      { access_token: accessToken },
      (response: any) => {
        if (!response || response.error) {
          reject(response?.error || new Error('Failed to get pages'));
          return;
        }
        
        // Transform the response to match our FacebookPage interface
        const pages: FacebookPage[] = response.data.map((page: any) => ({
          id: page.id,
          name: page.name,
          access_token: page.access_token,
          category: page.category,
          tasks: page.tasks || []
        }));
        
        resolve(pages);
      }
    );
  });
}

// Function to exchange authorization code for access token
// In production, this should be done server-side to protect app secret
export async function exchangeCodeForToken(code: string, redirectUri: string): Promise<string> {
  // This is a mock implementation for demonstration
  // In production, this would be a server-side API call
  
  console.log(`Would exchange code ${code.substring(0, 10)}... for token`);
  console.log(`Using redirect URI: ${redirectUri}`);
  
  // Simulating the exchange process
  await new Promise(resolve => setTimeout(resolve, 1500));
  
  // Return a mock access token
  return `EAATk...${Math.random().toString(36).substring(2, 10)}`;
}

// Gets a long-lived page access token
// In production, this should be done server-side
export async function getLongLivedPageToken(accessToken: string, pageId: string): Promise<string> {
  // This is a mock implementation for demonstration
  // In production, this would be a server-side API call to exchange the token
  
  console.log(`Would exchange page token for ${pageId}`);
  
  // Simulating the exchange process
  await new Promise(resolve => setTimeout(resolve, 1000));
  
  // Return a mock long-lived token
  return `EAATkLongLived...${Math.random().toString(36).substring(2, 10)}`;
}

// A helper function to check if the Facebook SDK is ready
export function isFacebookSDKLoaded(): boolean {
  return typeof FB !== 'undefined';
}