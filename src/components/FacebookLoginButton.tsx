import React, { useEffect, useRef, useState } from 'react';
import { handleFacebookStatusChange } from '../lib/facebookAuth';
import { AlertTriangle } from 'lucide-react';

interface FacebookLoginButtonProps {
  onLoginSuccess?: () => void;
  onLoginFailure?: (error: string) => void;
  scope?: string;
  autoLogoutLink?: boolean;
  width?: string;
}

declare global {
  interface Window {
    checkLoginState: () => void;
    FB: any;
    fbAsyncInit: any;
  }
}

const FacebookLoginButton: React.FC<FacebookLoginButtonProps> = ({
  onLoginSuccess,
  onLoginFailure,
  scope = "public_profile,email,pages_show_list,pages_messaging",
  autoLogoutLink = false,
  width = "300px"
}) => {
  const buttonRef = useRef<HTMLDivElement>(null);
  const buttonId = `fb-button-${Math.random().toString(36).substring(2, 10)}`;
  const [sdkLoaded, setSdkLoaded] = useState(false);
  const [sdkError, setSdkError] = useState('');

  // Define the global callback function that the FB button will call
  useEffect(() => {
    window.checkLoginState = function() {
      if (typeof window.FB !== 'undefined') {
        window.FB.getLoginStatus(function(response: any) {
          statusChangeCallback(response);
        });
      } else {
        console.error("Facebook SDK not initialized");
        setSdkError("Facebook SDK failed to initialize. Please refresh the page and try again.");
        if (onLoginFailure) onLoginFailure("Facebook SDK not initialized");
      }
    };

    // Process the login status
    const statusChangeCallback = async (response: any) => {
      console.log('Facebook login status response:', response);
      
      try {
        const success = await handleFacebookStatusChange(response);
        if (success && onLoginSuccess) {
          onLoginSuccess();
        } else if (!success && onLoginFailure) {
          onLoginFailure('Login was not successful');
        }
      } catch (error) {
        console.error('Error handling Facebook status change:', error);
        setSdkError(error instanceof Error ? error.message : 'Unknown error occurred');
        if (onLoginFailure) {
          onLoginFailure(error instanceof Error ? error.message : 'Unknown error occurred');
        }
      }
    };

    // Check periodically if the Facebook SDK is loaded
    const checkFBInterval = setInterval(() => {
      if (typeof window.FB !== 'undefined' && buttonRef.current) {
        console.log("Facebook SDK loaded, parsing XFBML");
        setSdkLoaded(true);
        try {
          // Remove any existing button first to prevent duplication
          const existingButtons = buttonRef.current.querySelectorAll('.fb-login-button');
          existingButtons.forEach(button => {
            if (button.id !== buttonId) {
              button.remove();
            }
          });
          
          // Then parse the XFBML
          window.FB.XFBML.parse(buttonRef.current);
        } catch (e) {
          console.error("Error parsing XFBML:", e);
          setSdkError('Failed to initialize Facebook login. Please refresh the page.');
        }
        clearInterval(checkFBInterval);
      }
    }, 500);
    
    // Cleanup interval after 20 seconds to prevent memory leaks
    setTimeout(() => {
      if (!sdkLoaded) {
        clearInterval(checkFBInterval);
        setSdkError('Facebook SDK failed to load after multiple attempts. Please check your internet connection and try again.');
      }
    }, 20000);

    // Cleanup function
    return () => {
      clearInterval(checkFBInterval);
      // Keep the global checkLoginState function as other buttons might need it
    };
  }, [scope, onLoginSuccess, onLoginFailure, buttonId, sdkLoaded]);

  // Force manual initialization if FB SDK is available but not loaded properly
  const handleManualInitialization = () => {
    if (typeof window.FB !== 'undefined' && buttonRef.current) {
      try {
        window.FB.XFBML.parse(buttonRef.current);
        setSdkError('');
        setSdkLoaded(true);
      } catch (e) {
        console.error("Error in manual initialization:", e);
      }
    } else {
      // If the SDK is not available, try reloading the script
      const fbScript = document.getElementById('facebook-jssdk');
      if (fbScript) {
        fbScript.remove();
      }
      
      // Create and append a new script element
      const script = document.createElement('script');
      script.id = 'facebook-jssdk';
      script.src = "https://connect.facebook.net/en_US/sdk.js";
      script.async = true;
      script.defer = true;
      script.crossOrigin = "anonymous";
      document.head.appendChild(script);
      
      script.onload = () => {
        console.log("Facebook SDK manually reloaded");
        
        // Initialize the SDK
        if (typeof window.FB !== 'undefined') {
          window.FB.init({
            appId: import.meta.env.VITE_META_APP_ID,
            cookie: true,
            xfbml: true,
            version: 'v18.0'
          });
          
          if (buttonRef.current) {
            window.FB.XFBML.parse(buttonRef.current);
            setSdkError('');
            setSdkLoaded(true);
          }
        }
      };
      
      script.onerror = () => {
        setSdkError('Failed to load Facebook SDK. Please check your internet connection.');
      };
    }
  };

  // Fallback to direct URL if button doesn't load
  const handleDirectLogin = () => {
    const appId = import.meta.env.VITE_META_APP_ID;
    if (!appId) {
      setSdkError('Facebook App ID is missing. Please check your configuration.');
      return;
    }
    
    const redirectUri = encodeURIComponent(`${window.location.origin}/oauth/facebook/callback`);
    const loginUrl = `https://www.facebook.com/v18.0/dialog/oauth?client_id=${appId}&redirect_uri=${redirectUri}&scope=${encodeURIComponent(scope)}&response_type=code`;
    
    console.log('Redirecting to Facebook login URL:', loginUrl);
    window.location.href = loginUrl;
  };

  return (
    <div className="space-y-3">
      <div className="facebook-login-container" ref={buttonRef}>
        <div 
          id={buttonId}
          className="fb-login-button" 
          data-width={width}
          data-size="large"
          data-button-type="continue_with"
          data-layout="rounded"
          data-auto-logout-link={autoLogoutLink ? "true" : "false"}
          data-use-continue-as="false"
          data-scope={scope}
          data-onlogin="checkLoginState();"
        ></div>
      </div>
      
      {sdkError && (
        <div className="bg-red-50 border border-red-200 rounded p-3">
          <div className="flex items-start">
            <AlertTriangle className="h-5 w-5 text-red-400 mr-2 mt-0.5" />
            <div>
              <p className="text-sm text-red-700">{sdkError}</p>
              <div className="mt-2 flex flex-col sm:flex-row gap-2">
                <button 
                  onClick={handleManualInitialization}
                  className="text-xs px-2 py-1 bg-red-100 text-red-700 rounded hover:bg-red-200"
                >
                  Retry Loading
                </button>
                <button 
                  onClick={handleDirectLogin}
                  className="text-xs px-2 py-1 bg-blue-100 text-blue-700 rounded hover:bg-blue-200"
                >
                  Login Directly
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default FacebookLoginButton;