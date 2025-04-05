import React from 'react';
import { Outlet, Link, useLocation, useNavigate } from 'react-router-dom';
import { ShieldCheck, Users, MessageSquare, Webhook, LogOut, LayoutDashboard, Database, Settings, User } from 'lucide-react';
import { supabase } from '../../lib/supabase';

export default function AdminLayout() {
  const location = useLocation();
  const navigate = useNavigate();
  
  const handleSignOut = async () => {
    await supabase.auth.signOut();
    navigate('/auth');
  };

  return (
    <div className="min-h-screen bg-gray-100">
      {/* Sidebar */}
      <div className="fixed inset-y-0 left-0 w-64 bg-gray-900 text-white overflow-y-auto">
        <div className="flex items-center justify-center h-16 bg-gray-800">
          <ShieldCheck className="h-8 w-8 text-red-500" />
          <span className="ml-2 text-xl font-bold">Admin Portal</span>
        </div>
        
        <div className="px-4 py-3 bg-gray-800 border-b border-gray-700">
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <User className="h-8 w-8 rounded-full bg-red-500 p-1" />
            </div>
            <div className="ml-3">
              <p className="text-sm font-medium text-white">Administrator</p>
              <p className="text-xs font-medium text-gray-400">Full Access</p>
            </div>
          </div>
        </div>
        
        <nav className="mt-5 px-2 space-y-1">
          <Link
            to="/admin"
            className={`${
              location.pathname === '/admin'
                ? 'bg-gray-800 text-white'
                : 'text-gray-300 hover:bg-gray-700 hover:text-white'
            } group flex items-center px-4 py-3 text-sm font-medium rounded-md transition-colors duration-200`}
          >
            <LayoutDashboard className="h-5 w-5 mr-3 text-gray-400 group-hover:text-gray-300" />
            Dashboard
          </Link>
          <Link
            to="/admin/users"
            className={`${
              location.pathname.startsWith('/admin/users')
                ? 'bg-gray-800 text-white'
                : 'text-gray-300 hover:bg-gray-700 hover:text-white'
            } group flex items-center px-4 py-3 text-sm font-medium rounded-md transition-colors duration-200`}
          >
            <Users className="h-5 w-5 mr-3 text-gray-400 group-hover:text-gray-300" />
            User Management
          </Link>
          <Link
            to="/admin/webhooks"
            className={`${
              location.pathname === '/admin/webhooks'
                ? 'bg-gray-800 text-white'
                : 'text-gray-300 hover:bg-gray-700 hover:text-white'
            } group flex items-center px-4 py-3 text-sm font-medium rounded-md transition-colors duration-200`}
          >
            <Webhook className="h-5 w-5 mr-3 text-gray-400 group-hover:text-gray-300" />
            Webhook Setup
          </Link>
          
          <div className="px-3 py-3">
            <div className="border-t border-gray-700"></div>
          </div>
          
          <Link
            to="/dashboard"
            className="text-gray-300 hover:bg-gray-700 hover:text-white group flex items-center px-4 py-3 text-sm font-medium rounded-md transition-colors duration-200"
          >
            <MessageSquare className="h-5 w-5 mr-3 text-gray-400 group-hover:text-gray-300" />
            Exit Admin Portal
          </Link>
          
          <button
            onClick={handleSignOut}
            className="w-full text-left text-gray-300 hover:bg-gray-700 hover:text-white group flex items-center px-4 py-3 text-sm font-medium rounded-md transition-colors duration-200"
          >
            <LogOut className="h-5 w-5 mr-3 text-gray-400 group-hover:text-gray-300" />
            Sign Out
          </button>
        </nav>
        
        <div className="absolute bottom-0 w-full bg-gray-800 px-4 py-3 text-xs text-gray-400 border-t border-gray-700">
          <p>AI Assistant Platform</p>
          <p>Admin Portal v1.0</p>
        </div>
      </div>

      {/* Main content */}
      <div className="pl-64">
        <header className="bg-white shadow">
          <div className="mx-auto px-4 py-6 sm:px-6 lg:px-8 flex justify-between items-center">
            <h1 className="text-2xl font-bold text-gray-900">
              {location.pathname === '/admin' && 'Admin Dashboard'}
              {location.pathname === '/admin/users' && 'User Management'}
              {location.pathname.match(/\/admin\/users\/[^/]+/) && 'User Detail'}
              {location.pathname === '/admin/webhooks' && 'Webhook Configuration'}
            </h1>
            <div>
              <Link 
                to={location.pathname.match(/\/admin\/users\/[^/]+/) ? '/admin/users' : '/admin'}
                className="inline-flex items-center px-4 py-2 border border-gray-300 shadow-sm text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
              >
                {location.pathname.match(/\/admin\/users\/[^/]+/) ? 'Back to Users' : 'Back to Dashboard'}
              </Link>
            </div>
          </div>
        </header>
        <main>
          <div className="mx-auto py-6 sm:px-6 lg:px-8">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
}