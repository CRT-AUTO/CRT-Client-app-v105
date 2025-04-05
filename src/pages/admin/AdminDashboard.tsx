import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Users, MessageCircle, GitBranch, MessagesSquare, RefreshCw } from 'lucide-react';
import { getUserSummaries } from '../../lib/api';
import { isAdmin } from '../../lib/auth';
import { UserSummary } from '../../types';
import LoadingIndicator from '../../components/LoadingIndicator';
import ErrorAlert from '../../components/ErrorAlert';

export default function AdminDashboard() {
  const [users, setUsers] = useState<UserSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isAdminUser, setIsAdminUser] = useState(false);

  useEffect(() => {
    // First check if user is really an admin
    async function checkAdminStatus() {
      try {
        const adminStatus = await isAdmin();
        setIsAdminUser(adminStatus);
        
        if (adminStatus) {
          loadData();
        } else {
          setError('You do not have admin permissions to view this page.');
          setLoading(false);
        }
      } catch (err) {
        console.error('Error checking admin status:', err);
        setError('Failed to verify admin permissions.');
        setLoading(false);
      }
    }
    
    checkAdminStatus();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      setError(null);
      
      try {
        const summaries = await getUserSummaries();
        setUsers(summaries);
      } catch (err) {
        console.error('Error loading admin dashboard data:', err);
        setError('Failed to load dashboard data. This may be due to permission issues.');
      }
    } catch (err) {
      console.error('Error loading admin dashboard data:', err);
      setError('Failed to load dashboard data. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleRefresh = async () => {
    try {
      setRefreshing(true);
      await loadData();
    } finally {
      setRefreshing(false);
    }
  };

  if (loading) {
    return <LoadingIndicator message="Loading admin dashboard..." />;
  }
  
  // If not admin, show appropriate message
  if (!isAdminUser) {
    return (
      <div className="bg-red-50 border-l-4 border-red-400 p-4">
        <div className="flex">
          <div className="ml-3">
            <p className="text-sm text-red-700">
              {error || 'You do not have permission to access the admin dashboard.'}
            </p>
          </div>
        </div>
      </div>
    );
  }

  // Calculate overall system stats
  const totalUsers = users.length;
  const admins = users.filter(user => user.role === 'admin').length;
  const activeUsers = users.filter(user => user.conversationCount > 0).length;
  const totalConversations = users.reduce((sum, user) => sum + user.conversationCount, 0);
  const totalMessages = users.reduce((sum, user) => sum + user.messageCount, 0);
  const usersWithFacebook = users.filter(user => user.connections.facebook).length;
  const usersWithInstagram = users.filter(user => user.connections.instagram).length;
  const usersWithVoiceflow = users.filter(user => user.voiceflow).length;
  const usersWithWebhook = users.filter(user => user.webhook).length;

  return (
    <div className="space-y-6">
      {error && (
        <div className="bg-red-50 border-l-4 border-red-400 p-4 mb-4">
          <div className="flex">
            <div className="flex-shrink-0">
              <svg className="h-5 w-5 text-red-400" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
              </svg>
            </div>
            <div className="ml-3">
              <p className="text-sm text-red-700">{error}</p>
            </div>
          </div>
        </div>
      )}
      
      <div className="flex justify-between items-center">
        <h2 className="text-xl font-semibold text-gray-700">System Overview</h2>
        <button
          onClick={handleRefresh}
          disabled={refreshing}
          className="flex items-center px-3 py-2 border border-gray-300 shadow-sm text-sm leading-4 font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50"
        >
          {refreshing ? (
            <RefreshCw className="h-4 w-4 mr-1 animate-spin" />
          ) : (
            <RefreshCw className="h-4 w-4 mr-1" />
          )}
          Refresh
        </button>
      </div>
      
      {/* Key metrics cards */}
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
        <div className="bg-white overflow-hidden shadow rounded-lg">
          <div className="p-5">
            <div className="flex items-center">
              <div className="flex-shrink-0 bg-indigo-100 rounded-md p-3">
                <Users className="h-6 w-6 text-indigo-600" />
              </div>
              <div className="ml-5 w-0 flex-1">
                <dl>
                  <dt className="text-sm font-medium text-gray-500 truncate">Total Users</dt>
                  <dd className="flex items-baseline">
                    <div className="text-2xl font-semibold text-gray-900">{totalUsers}</div>
                    <div className="ml-2 text-sm font-medium text-gray-500">
                      ({admins} admins)
                    </div>
                  </dd>
                </dl>
              </div>
            </div>
          </div>
          <div className="bg-gray-50 px-5 py-3">
            <div className="text-sm">
              <Link to="/admin/users" className="font-medium text-indigo-600 hover:text-indigo-900">View all users</Link>
            </div>
          </div>
        </div>
        
        <div className="bg-white overflow-hidden shadow rounded-lg">
          <div className="p-5">
            <div className="flex items-center">
              <div className="flex-shrink-0 bg-green-100 rounded-md p-3">
                <MessageCircle className="h-6 w-6 text-green-600" />
              </div>
              <div className="ml-5 w-0 flex-1">
                <dl>
                  <dt className="text-sm font-medium text-gray-500 truncate">Active Users</dt>
                  <dd className="flex items-baseline">
                    <div className="text-2xl font-semibold text-gray-900">{activeUsers}</div>
                    <div className="ml-2 text-sm font-medium text-gray-500">
                      ({totalUsers > 0 ? ((activeUsers / totalUsers) * 100).toFixed(0) : 0}%)
                    </div>
                  </dd>
                </dl>
              </div>
            </div>
          </div>
          <div className="bg-gray-50 px-5 py-3">
            <div className="text-sm">
              <span className="font-medium text-gray-500">Users with conversations</span>
            </div>
          </div>
        </div>
        
        <div className="bg-white overflow-hidden shadow rounded-lg">
          <div className="p-5">
            <div className="flex items-center">
              <div className="flex-shrink-0 bg-blue-100 rounded-md p-3">
                <GitBranch className="h-6 w-6 text-blue-600" />
              </div>
              <div className="ml-5 w-0 flex-1">
                <dl>
                  <dt className="text-sm font-medium text-gray-500 truncate">Total Conversations</dt>
                  <dd className="flex items-baseline">
                    <div className="text-2xl font-semibold text-gray-900">{totalConversations}</div>
                    <div className="ml-2 text-sm font-medium text-gray-500">
                      ({(totalUsers > 0 ? (totalConversations / totalUsers) : 0).toFixed(1)} avg/user)
                    </div>
                  </dd>
                </dl>
              </div>
            </div>
          </div>
          <div className="bg-gray-50 px-5 py-3">
            <div className="text-sm">
              <span className="font-medium text-gray-500">Across all platforms</span>
            </div>
          </div>
        </div>
        
        <div className="bg-white overflow-hidden shadow rounded-lg">
          <div className="p-5">
            <div className="flex items-center">
              <div className="flex-shrink-0 bg-purple-100 rounded-md p-3">
                <MessagesSquare className="h-6 w-6 text-purple-600" />
              </div>
              <div className="ml-5 w-0 flex-1">
                <dl>
                  <dt className="text-sm font-medium text-gray-500 truncate">Total Messages</dt>
                  <dd className="flex items-baseline">
                    <div className="text-2xl font-semibold text-gray-900">{totalMessages}</div>
                    <div className="ml-2 text-sm font-medium text-gray-500">
                      ({(totalConversations > 0 ? (totalMessages / totalConversations) : 0).toFixed(1)} avg/conv)
                    </div>
                  </dd>
                </dl>
              </div>
            </div>
          </div>
          <div className="bg-gray-50 px-5 py-3">
            <div className="text-sm">
              <span className="font-medium text-gray-500">Exchanged in the system</span>
            </div>
          </div>
        </div>
      </div>
      
      {/* Integration stats */}
      <div className="bg-white shadow rounded-lg overflow-hidden">
        <div className="px-4 py-5 sm:px-6">
          <h3 className="text-lg leading-6 font-medium text-gray-900">Integration Statistics</h3>
          <p className="mt-1 max-w-2xl text-sm text-gray-500">Overview of user integrations with various services.</p>
        </div>
        <div className="border-t border-gray-200 px-4 py-5 sm:p-6">
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
            <div className="border rounded-lg p-5">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium text-gray-500">Facebook</span>
                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                  {usersWithFacebook} users
                </span>
              </div>
              <div className="relative pt-1">
                <div className="overflow-hidden h-2 text-xs flex rounded bg-blue-200">
                  <div 
                    style={{ width: `${totalUsers > 0 ? (usersWithFacebook / totalUsers) * 100 : 0}%` }} 
                    className="shadow-none flex flex-col text-center whitespace-nowrap text-white justify-center bg-blue-600">
                  </div>
                </div>
              </div>
              <p className="mt-2 text-xs text-gray-500">
                {totalUsers > 0 ? ((usersWithFacebook / totalUsers) * 100).toFixed(0) : 0}% of users have Facebook connected
              </p>
            </div>
            
            <div className="border rounded-lg p-5">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium text-gray-500">Instagram</span>
                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-pink-100 text-pink-800">
                  {usersWithInstagram} users
                </span>
              </div>
              <div className="relative pt-1">
                <div className="overflow-hidden h-2 text-xs flex rounded bg-pink-200">
                  <div 
                    style={{ width: `${totalUsers > 0 ? (usersWithInstagram / totalUsers) * 100 : 0}%` }} 
                    className="shadow-none flex flex-col text-center whitespace-nowrap text-white justify-center bg-pink-600">
                  </div>
                </div>
              </div>
              <p className="mt-2 text-xs text-gray-500">
                {totalUsers > 0 ? ((usersWithInstagram / totalUsers) * 100).toFixed(0) : 0}% of users have Instagram connected
              </p>
            </div>
            
            <div className="border rounded-lg p-5">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium text-gray-500">Voiceflow</span>
                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-indigo-100 text-indigo-800">
                  {usersWithVoiceflow} users
                </span>
              </div>
              <div className="relative pt-1">
                <div className="overflow-hidden h-2 text-xs flex rounded bg-indigo-200">
                  <div 
                    style={{ width: `${totalUsers > 0 ? (usersWithVoiceflow / totalUsers) * 100 : 0}%` }} 
                    className="shadow-none flex flex-col text-center whitespace-nowrap text-white justify-center bg-indigo-600">
                  </div>
                </div>
              </div>
              <p className="mt-2 text-xs text-gray-500">
                {totalUsers > 0 ? ((usersWithVoiceflow / totalUsers) * 100).toFixed(0) : 0}% of users have Voiceflow configured
              </p>
            </div>
            
            <div className="border rounded-lg p-5">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium text-gray-500">Webhooks</span>
                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                  {usersWithWebhook} users
                </span>
              </div>
              <div className="relative pt-1">
                <div className="overflow-hidden h-2 text-xs flex rounded bg-green-200">
                  <div 
                    style={{ width: `${totalUsers > 0 ? (usersWithWebhook / totalUsers) * 100 : 0}%` }} 
                    className="shadow-none flex flex-col text-center whitespace-nowrap text-white justify-center bg-green-600">
                  </div>
                </div>
              </div>
              <p className="mt-2 text-xs text-gray-500">
                {totalUsers > 0 ? ((usersWithWebhook / totalUsers) * 100).toFixed(0) : 0}% of users have webhooks configured
              </p>
            </div>
          </div>
        </div>
      </div>
      
      {/* Recent users */}
      <div className="bg-white shadow rounded-lg">
        <div className="px-4 py-5 sm:px-6 flex justify-between items-center">
          <div>
            <h3 className="text-lg leading-6 font-medium text-gray-900">Recent Users</h3>
            <p className="mt-1 max-w-2xl text-sm text-gray-500">Latest users joining the platform.</p>
          </div>
          <Link 
            to="/admin/users" 
            className="inline-flex items-center px-3 py-2 border border-gray-300 shadow-sm text-sm leading-4 font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50"
          >
            View All Users
          </Link>
        </div>
        <div className="border-t border-gray-200">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Email
                  </th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Role
                  </th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Created
                  </th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Connections
                  </th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Activity
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {users.slice(0, 5).map(user => (
                  <tr key={user.id}>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        <div className="ml-4">
                          <div className="text-sm font-medium text-gray-900">
                            <Link to={`/admin/users/${user.id}`} className="hover:text-indigo-600">
                              {user.email}
                            </Link>
                          </div>
                          <div className="text-sm text-gray-500">{user.id.slice(0, 8)}...</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                        user.role === 'admin' 
                          ? 'bg-red-100 text-red-800' 
                          : 'bg-green-100 text-green-800'
                      }`}>
                        {user.role}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {new Date(user.created_at).toLocaleDateString()}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex space-x-1">
                        {user.connections.facebook && (
                          <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-800">
                            FB
                          </span>
                        )}
                        {user.connections.instagram && (
                          <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-pink-100 text-pink-800">
                            IG
                          </span>
                        )}
                        {user.voiceflow && (
                          <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-indigo-100 text-indigo-800">
                            VF
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {user.messageCount > 0 ? (
                        <span>{user.messageCount} msgs / {user.conversationCount} convs</span>
                      ) : (
                        <span className="text-gray-400">No activity</span>
                      )}
                    </td>
                  </tr>
                ))}
                
                {users.length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-6 py-10 text-center text-gray-500">
                      No users found or unable to load user data
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}