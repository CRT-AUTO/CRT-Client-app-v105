import React, { useEffect, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { getAuthStatus } from '../lib/auth';
import LoadingIndicator from './LoadingIndicator';

interface AdminAuthProps {
  children: React.ReactNode;
}

/**
 * Component to ensure only admin users can access protected routes
 */
const AdminAuth: React.FC<AdminAuthProps> = ({ children }) => {
  const [checking, setChecking] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  
  useEffect(() => {
    async function checkAdminStatus() {
      try {
        const authStatus = await getAuthStatus();
        
        setIsAuthenticated(authStatus.isAuthenticated);
        setIsAdmin(authStatus.isAdmin);
        
        if (!authStatus.isAuthenticated) {
          console.log('User not authenticated, redirecting to login');
        } else if (!authStatus.isAdmin) {
          console.log('User authenticated but not admin, redirecting to dashboard');
        } else {
          console.log('Admin access confirmed');
        }
      } catch (error) {
        console.error('Error checking admin status:', error);
      } finally {
        setChecking(false);
      }
    }
    
    checkAdminStatus();
  }, []);
  
  if (checking) {
    return <LoadingIndicator message="Verifying admin access..." />;
  }
  
  if (!isAuthenticated) {
    return <Navigate to="/auth" replace />;
  }
  
  if (!isAdmin) {
    return <Navigate to="/dashboard" replace />;
  }
  
  return <>{children}</>;
};

export default AdminAuth;