import React, { useState, useEffect } from 'react';
import { Outlet, Link, useLocation, useNavigate } from 'react-router-dom';
import { LayoutDashboard, MessageSquare, Settings, LogOut, Book, MessageCircle, AlertTriangle, Users, ShieldCheck } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { getCurrentUser, isAdmin } from '../lib/auth';
import { User } from '../types';

interface LayoutProps {
  voiceflowInitialized?: boolean;
}

export default function Layout({ voiceflowInitialized = false }: LayoutProps) {
  const location = useLocation();
  const navigate = useNavigate();
  const [user, setUser] = useState<User | null>(null);
  const [userIsAdmin, setUserIsAdmin] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  useEffect(() => {
    async function fetchUserData() {
      try {
        setLoading(true);
        const currentUser = await getCurrentUser();
        setUser(currentUser);
        
        if (currentUser) {
          try {
            const adminStatus = await isAdmin();
            setUserIsAdmin(adminStatus);
          } catch (adminErr) {
            // If checking admin status fails, assume not admin
            console.error('Error checking admin status:', adminErr);
            setUserIsAdmin(false);
          }
        }
        
        setLoading(false);
      } catch (err) {
        console.error('Error fetching user data:', err);
        setError('Failed to load user data');
        setLoading(false);
        
        // Set default user values to prevent UI breakage
        if (!user) {
          const { data: { session } } = await supabase.auth.getSession();
          if (session?.user) {
            setUser({
              id: session.user.id,
              email: session.user.email || '',
              role: 'customer',
              created_at: session.user.created_at || new Date().toISOString()
            });
          }
        }
      }
    }
    
    fetchUserData();
  }, []);
  
  const handleSignOut = async () => {
    try {
      await supabase.auth.signOut();
      // Navigate to auth page after sign out
      navigate('/auth');
    } catch (error) {
      console.error('Error signing out:', error);
      setError('Failed to sign out. Please try again.');
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            <div className="flex">
              <div className="flex-shrink-0 flex items-center">
                <MessageSquare className="h-8 w-8 text-indigo-600" />
                <span className="ml-2 text-xl font-bold text-gray-900">AI Assistant Platform</span>
                {userIsAdmin && (
                  <span className="ml-2 px-2 py-1 text-xs font-semibold rounded-full bg-red-100 text-red-800">
                    Admin
                  </span>
                )}
              </div>
              <div className="hidden sm:ml-6 sm:flex sm:space-x-8">
                <Link
                  to="/dashboard"
                  className={`${
                    location.pathname === '/dashboard'
                      ? 'border-indigo-500 text-gray-900'
                      : 'border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700'
                  } inline-flex items-center px-1 pt-1 border-b-2 text-sm font-medium`}
                >
                  <LayoutDashboard className="h-5 w-5 mr-1" />
                  Dashboard
                </Link>
                <Link
                  to="/messages"
                  className={`${
                    location.pathname.startsWith('/messages')
                      ? 'border-indigo-500 text-gray-900'
                      : 'border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700'
                  } inline-flex items-center px-1 pt-1 border-b-2 text-sm font-medium`}
                >
                  <MessageCircle className="h-5 w-5 mr-1" />
                  Messages
                </Link>
                <Link
                  to="/settings"
                  className={`${
                    location.pathname === '/settings'
                      ? 'border-indigo-500 text-gray-900'
                      : 'border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700'
                  } inline-flex items-center px-1 pt-1 border-b-2 text-sm font-medium`}
                >
                  <Settings className="h-5 w-5 mr-1" />
                  Settings
                </Link>
                
                {userIsAdmin && (
                  <Link
                    to="/admin"
                    className={`${
                      location.pathname.startsWith('/admin')
                        ? 'border-red-500 text-gray-900'
                        : 'border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700'
                    } inline-flex items-center px-1 pt-1 border-b-2 text-sm font-medium`}
                  >
                    <ShieldCheck className="h-5 w-5 mr-1" />
                    Admin Portal
                  </Link>
                )}
              </div>
            </div>
            <div className="hidden sm:ml-6 sm:flex sm:items-center">
              {user && (
                <span className="text-sm text-gray-500 mr-4">
                  {user.email}
                </span>
              )}
              <button
                onClick={handleSignOut}
                className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-gray-500 hover:text-gray-700"
              >
                <LogOut className="h-5 w-5 mr-1" />
                Sign Out
              </button>
            </div>
            
            {/* Mobile menu button */}
            <div className="flex items-center sm:hidden">
              <button
                onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                className="inline-flex items-center justify-center p-2 rounded-md text-gray-400 hover:text-gray-500 hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-indigo-500"
              >
                <span className="sr-only">Open main menu</span>
                <svg
                  className={`${mobileMenuOpen ? 'hidden' : 'block'} h-6 w-6`}
                  xmlns="http://www.w3.org/2000/svg"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                </svg>
                <svg
                  className={`${mobileMenuOpen ? 'block' : 'hidden'} h-6 w-6`}
                  xmlns="http://www.w3.org/2000/svg"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          </div>
        </div>
        
        {/* Mobile menu */}
        <div className={`${mobileMenuOpen ? 'block' : 'hidden'} sm:hidden`}>
          <div className="pt-2 pb-3 space-y-1">
            <Link
              to="/dashboard"
              className={`${
                location.pathname === '/dashboard'
                  ? 'bg-indigo-50 border-indigo-500 text-indigo-700'
                  : 'border-transparent text-gray-500 hover:bg-gray-50 hover:border-gray-300 hover:text-gray-700'
              } group flex items-center px-4 py-3 text-sm font-medium rounded-md transition-colors duration-200`}
              onClick={() => setMobileMenuOpen(false)}
            >
              <LayoutDashboard className="h-5 w-5 mr-3 text-gray-400 group-hover:text-gray-300" />
              Dashboard
            </Link>
            <Link
              to="/messages"
              className={`${
                location.pathname.startsWith('/messages')
                  ? 'bg-indigo-50 border-indigo-500 text-indigo-700'
                  : 'border-transparent text-gray-500 hover:bg-gray-50 hover:border-gray-300 hover:text-gray-700'
              } group flex items-center px-4 py-3 text-sm font-medium rounded-md transition-colors duration-200`}
              onClick={() => setMobileMenuOpen(false)}
            >
              <MessageCircle className="h-5 w-5 mr-3 text-gray-400 group-hover:text-gray-300" />
              Messages
            </Link>
            <Link
              to="/settings"
              className={`${
                location.pathname === '/settings'
                  ? 'bg-indigo-50 border-indigo-500 text-indigo-700'
                  : 'border-transparent text-gray-500 hover:bg-gray-50 hover:border-gray-300 hover:text-gray-700'
              } group flex items-center px-4 py-3 text-sm font-medium rounded-md transition-colors duration-200`}
              onClick={() => setMobileMenuOpen(false)}
            >
              <Settings className="h-5 w-5 mr-3 text-gray-400 group-hover:text-gray-300" />
              Settings
            </Link>
            
            {userIsAdmin && (
              <Link
                to="/admin"
                className={`${
                  location.pathname.startsWith('/admin')
                    ? 'bg-red-50 border-red-500 text-red-700'
                    : 'border-transparent text-gray-500 hover:bg-gray-50 hover:border-gray-300 hover:text-gray-700'
                } block pl-3 pr-4 py-2 border-l-4 text-base font-medium`}
                onClick={() => setMobileMenuOpen(false)}
              >
                Admin Portal
              </Link>
            )}
            
            <button
              onClick={() => {
                handleSignOut();
                setMobileMenuOpen(false);
              }}
              className="w-full text-left text-gray-300 hover:bg-gray-50 hover:text-gray-700 group flex items-center px-4 py-3 text-sm font-medium rounded-md transition-colors duration-200"
            >
              <LogOut className="h-5 w-5 mr-3 text-gray-400 group-hover:text-gray-300" />
              Sign Out
            </button>
          </div>
        </div>
      </nav>

      {!voiceflowInitialized && location.pathname !== '/settings' && !location.pathname.startsWith('/admin') && (
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-4">
          <div className="bg-yellow-50 border-l-4 border-yellow-400 p-4">
            <div className="flex">
              <div className="flex-shrink-0">
                <AlertTriangle className="h-5 w-5 text-yellow-400" aria-hidden="true" />
              </div>
              <div className="ml-3">
                <p className="text-sm text-yellow-700">
                  Voiceflow agent is not configured. Some features may not work correctly.
                  <Link to="/settings" className="font-medium underline text-yellow-700 hover:text-yellow-600 ml-1">
                    Go to Settings
                  </Link> to configure your Voiceflow agent.
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {error && (
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-4">
          <div className="bg-red-50 border-l-4 border-red-400 p-4">
            <div className="flex">
              <div className="flex-shrink-0">
                <AlertTriangle className="h-5 w-5 text-red-400" aria-hidden="true" />
              </div>
              <div className="ml-3">
                <p className="text-sm text-red-700">
                  {error}
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      <main className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
        <Outlet />
      </main>
    </div>
  );
}