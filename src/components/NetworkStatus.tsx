import React, { useState, useEffect, ReactNode } from 'react';
import { Wifi, WifiOff, RefreshCw } from 'lucide-react';

interface NetworkStatusProps {
  children: ReactNode;
}

const NetworkStatus: React.FC<NetworkStatusProps> = ({ children }) => {
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [showOfflineMessage, setShowOfflineMessage] = useState(false);
  
  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      // Keep showing the offline message for a short time after coming back online
      setTimeout(() => setShowOfflineMessage(false), 2000);
    };
    
    const handleOffline = () => {
      setIsOnline(false);
      setShowOfflineMessage(true);
    };
    
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);
  
  const handleRefresh = () => {
    window.location.reload();
  };
  
  return (
    <>
      {showOfflineMessage && (
        <div className={`fixed top-0 left-0 right-0 p-2 text-center z-50 transition-all duration-300 ${
          isOnline ? 'bg-green-500 text-white' : 'bg-red-500 text-white'
        }`}>
          <div className="flex items-center justify-center">
            {isOnline ? (
              <>
                <Wifi className="h-4 w-4 mr-2" />
                <span>Your internet connection has been restored</span>
              </>
            ) : (
              <>
                <WifiOff className="h-4 w-4 mr-2" />
                <span>You are currently offline. Some features may not work.</span>
                <button 
                  onClick={handleRefresh}
                  className="ml-3 inline-flex items-center px-2 py-1 bg-white bg-opacity-20 rounded text-white text-xs hover:bg-opacity-30"
                >
                  <RefreshCw className="h-3 w-3 mr-1" />
                  Refresh
                </button>
              </>
            )}
          </div>
        </div>
      )}
      {children}
    </>
  );
};

export default NetworkStatus;