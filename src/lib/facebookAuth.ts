import { supabase } from './supabase';
import type { User, AuthStatus } from '../types';

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
  tasks?: string[];
}

// Check Facebook login status
export function checkFacebookLoginStatus(): Promise<FacebookStatusResponse> {
  return new Promise((resolve) => {
    if (typeof window.FB === 'undefined') {
      console.error('Facebook SDK not loaded');
      resolve({ status: 'error', authResponse: null });
      return;
    }
    window.FB.getLoginStatus((response) => {
      console.log('Facebook login status:', response);
      resolve(response as FacebookStatusResponse);
    });
  });
}

// Callback function called from checkLoginState
export async function statusChangeCallback(response: FacebookStatusResponse): Promise<boolean> {
  return handleFacebookStatusChange(response);
}

// Handle status change – this function logs debug info, retrieves additional info and pages,
// saves the minimal auth state in localStorage, then redirects to the OAuth flow.
export function handleFacebookStatusChange(response: FacebookStatusResponse): Promise<boolean> {
  return new Promise(async (resolve) => {
    if (response.status === 'connected' && response.authResponse) {
      console.log('Connected to Facebook, authorized app');
      try {
        const fbToken = response.authResponse.accessToken;
        const userId = response.authResponse.userID;
        console.log('Facebook auth response:', {
          token: fbToken ? `${fbToken.substring(0, 10)}...` : 'missing',
          userId,
          expiresIn: response.authResponse.expiresIn
        });
        // Optionally, get additional user info
        try {
          const userInfo = await getFacebookUserInfo(userId, fbToken);
          console.log('Facebook user info:', userInfo);
        } catch (userInfoError) {
          console.warn('Could not get Facebook user info:', userInfoError);
        }
        // Get Facebook pages and store in localStorage if available
        try {
          const pages = await getFacebookPages(fbToken);
          console.log('Facebook pages:', pages);
          if (pages && pages.length > 0) {
            localStorage.setItem('fb_pages', JSON.stringify(pages));
          }
        } catch (pagesError) {
          console.warn('Could not get Facebook pages:', pagesError);
        }
        // Save current auth session in localStorage
        try {
          const { data: { session } } = await supabase.auth.getSession();
          if (session) {
            localStorage.setItem('fb_auth_state', JSON.stringify({
              userId: session.user.id,
              expiresAt: session.expires_at,
              timestamp: Date.now()
            }));
          }
        } catch (sessionError) {
          console.error('Error saving auth state:', sessionError);
        }
        // Redirect to Facebook OAuth dialog with code response type (for server-side token exchange)
        const appId = import.meta.env.VITE_META_APP_ID;
        const redirectUri = `https://crt-tech.org/oauth/facebook/callback`;
        if (!appId) {
          console.error('Facebook App ID is not configured');
          resolve(false);
          return;
        }
        window.location.href = `https://www.facebook.com/v18.0/dialog/oauth?client_id=${appId}&redirect_uri=${encodeURIComponent(redirectUri)}&response_type=code&scope=public_profile,email,pages_show_list,pages_messaging`;
        resolve(true);
      } catch (error) {
        console.error('Error handling Facebook login:', error);
        resolve(false);
      }
    } else if (response.status === 'not_authorized') {
      console.log('Not authorized: User is logged into Facebook but has not authorized the app');
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (session) {
          localStorage.setItem('fb_auth_state', JSON.stringify({
            userId: session.user.id,
            expiresAt: session.expires_at,
            timestamp: Date.now()
          }));
        }
      } catch (error) {
        console.error('Error saving auth state:', error);
      }
      const appId = import.meta.env.VITE_META_APP_ID;
      const redirectUri = `https://crt-tech.org/oauth/facebook/callback`;
      if (!appId) {
        console.error('Facebook App ID is not configured');
        resolve(false);
        return;
      }
      window.location.href = `https://www.facebook.com/v18.0/dialog/oauth?client_id=${appId}&redirect_uri=${encodeURIComponent(redirectUri)}&scope=public_profile,email,pages_show_list,pages_messaging&response_type=code`;
      resolve(false);
    } else {
      console.log('User is not logged into Facebook, initiating OAuth flow');
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (session) {
          localStorage.setItem('fb_auth_state', JSON.stringify({
            userId: session.user.id,
            expiresAt: session.expires_at,
            timestamp: Date.now()
          }));
        }
      } catch (error) {
        console.error('Error saving auth state:', error);
      }
      const appId = import.meta.env.VITE_META_APP_ID;
      const redirectUri = `https://crt-tech.org/oauth/facebook/callback`;
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

// Check login state using FB SDK
export function checkLoginState() {
  if (typeof window.FB === 'undefined') {
    console.error('Facebook SDK not loaded when checking login state');
    return;
  }
  window.FB.getLoginStatus(function(response: FacebookStatusResponse) {
    statusChangeCallback(response);
  });
}

// Initiate Facebook login
export function loginWithFacebook(): Promise<FacebookStatusResponse> {
  return new Promise((resolve, reject) => {
    if (typeof window.FB === 'undefined') {
      const appId = import.meta.env.VITE_META_APP_ID;
      const redirectUri = `https://crt-tech.org/oauth/facebook/callback`;
      if (!appId) {
        reject(new Error('Facebook App ID is not configured'));
        return;
      }
      supabase.auth.getSession().then(({ data: { session } }) => {
        if (session) {
          localStorage.setItem('fb_auth_state', JSON.stringify({
            userId: session.user.id,
            expiresAt: session.expires_at,
            timestamp: Date.now()
          }));
        }
        window.location.href = `https://www.facebook.com/v18.0/dialog/oauth?client_id=${appId}&redirect_uri=${encodeURIComponent(redirectUri)}&response_type=code&scope=public_profile,email,pages_show_list,pages_messaging`;
        reject(new Error('Facebook SDK not loaded, redirecting to OAuth flow'));
      }).catch(error => {
        console.error('Error getting session:', error);
        reject(error);
      });
      return;
    }
    window.FB.login((response) => {
      console.log("Facebook login response:", response);
      if (response.status === 'connected') {
        resolve(response as FacebookStatusResponse);
      } else {
        console.log("Facebook login was not successful:", response);
        resolve(response as FacebookStatusResponse);
      }
    }, { scope: 'public_profile,email,pages_show_list,pages_messaging', auth_type: 'rerequest' });
  });
}

// Get user information from Facebook
export function getFacebookUserInfo(userId: string, accessToken: string): Promise<any> {
  return new Promise((resolve, reject) => {
    if (typeof window.FB === 'undefined') {
      reject(new Error('Facebook SDK not loaded'));
      return;
    }
    window.FB.api(
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
    if (typeof window.FB === 'undefined') {
      reject(new Error('Facebook SDK not loaded'));
      return;
    }
    window.FB.api(
      '/me/accounts',
      'GET',
      { access_token: accessToken },
      (response: any) => {
        if (!response || response.error) {
          reject(response?.error || new Error('Failed to get pages'));
          return;
        }
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

// Exchange authorization code for access token
// (This is a mock implementation – in production, perform this server-side.)
export async function exchangeCodeForToken(code: string, redirectUri: string): Promise<string> {
  console.log(`Would exchange code ${code.substring(0, 10)}... for token`);
  console.log(`Using redirect URI: ${redirectUri}`);
  await new Promise(resolve => setTimeout(resolve, 1500));
  return `EAATk...${Math.random().toString(36).substring(2, 10)}`;
}

// Exchange short-lived page token for a long-lived token
// (Mock implementation – perform this securely server-side in production.)
export async function getLongLivedPageToken(accessToken: string, pageId: string): Promise<string> {
  console.log(`Would exchange page token for ${pageId}`);
  await new Promise(resolve => setTimeout(resolve, 1000));
  return `EAATkLongLived...${Math.random().toString(36).substring(2, 10)}`;
}

// Check if Facebook SDK is loaded
export function isFacebookSDKLoaded(): boolean {
  return typeof window.FB !== 'undefined';
}

// Restore saved Facebook auth state after returning from Facebook
export async function restoreFacebookAuthState(): Promise<boolean> {
  try {
    const savedState = localStorage.getItem('fb_auth_state');
    if (!savedState) return false;
    const parsedState = JSON.parse(savedState);
    const { userId, expiresAt, timestamp } = parsedState;
    if (Date.now() - timestamp > 15 * 60 * 1000) {
      localStorage.removeItem('fb_auth_state');
      return false;
    }
    const { data: { session } } = await supabase.auth.getSession();
    if (session) return true;
    const { data, error } = await supabase.auth.refreshSession();
    if (error || !data.session) {
      console.error('Failed to restore auth state:', error);
      return false;
    }
    localStorage.removeItem('fb_auth_state');
    return true;
  } catch (error) {
    console.error('Error restoring Facebook auth state:', error);
    return false;
  }
}
