import React, { useState, useEffect } from 'react';
import { Check, Save, AlertTriangle, Lock, Eye, EyeOff, Clock } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { SocialConnection } from '../types';
import { getDaysUntilExpiry } from '../lib/tokenRefresh';

interface TokenManagementProps {
  connection: SocialConnection | null;
  platform: 'facebook' | 'instagram';
  onTokenUpdated?: () => void;
  isAdminView?: boolean;
}

const TokenManagement: React.FC<TokenManagementProps> = ({ 
  connection, 
  platform,
  onTokenUpdated,
  isAdminView = false
}) => {
  const [token, setToken] = useState('');
  const [tokenExpiry, setTokenExpiry] = useState<string>('');
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showToken, setShowToken] = useState(false);

  useEffect(() => {
    if (connection) {
      setToken(connection.access_token || '');
      setTokenExpiry(connection.token_expiry || '');
    }
  }, [connection]);

  const handleSaveToken = async () => {
    if (!connection?.id || !token) {
      setError('Connection ID and token are required');
      return;
    }

    try {
      setSaving(true);
      setError(null);

      // Calculate default expiry date (60 days from now) if not provided
      let expiryDate = tokenExpiry;
      if (!expiryDate) {
        const date = new Date();
        date.setDate(date.getDate() + 60);
        expiryDate = date.toISOString();
      }

      // Update the token in the database
      const { error } = await supabase
        .from('social_connections')
        .update({ 
          access_token: token,
          token_expiry: expiryDate,
          refreshed_at: new Date().toISOString()
        })
        .eq('id', connection.id);

      if (error) throw error;

      setSuccess(true);
      if (onTokenUpdated) onTokenUpdated();
      
      // Clear success message after 3 seconds
      setTimeout(() => {
        setSuccess(false);
      }, 3000);
    } catch (err) {
      console.error('Error updating token:', err);
      setError(err instanceof Error ? err.message : 'Failed to update token');
    } finally {
      setSaving(false);
    }
  };

  const toggleShowToken = () => {
    setShowToken(!showToken);
  };
  
  const getExpiryStatusClass = () => {
    if (!tokenExpiry) return 'text-gray-500';
    const daysRemaining = getDaysUntilExpiry(tokenExpiry);
    if (daysRemaining <= 5) return 'text-red-600';
    if (daysRemaining <= 14) return 'text-yellow-600';
    return 'text-green-600';
  };
  
  const getExpiryStatus = () => {
    if (!tokenExpiry) return 'No expiry date set';
    const daysRemaining = getDaysUntilExpiry(tokenExpiry);
    if (daysRemaining <= 0) return 'Expired';
    if (daysRemaining === 1) return '1 day remaining';
    return `${daysRemaining} days remaining`;
  };

  return (
    <div className="space-y-4">
      <div>
        <label htmlFor={`${platform}-token`} className="block text-sm font-medium text-gray-700 flex items-center">
          <Lock className="h-4 w-4 mr-1" />
          {platform === 'facebook' ? 'Facebook Page Access Token' : 'Instagram Access Token'}
        </label>
        <div className="mt-1 flex rounded-md shadow-sm">
          <input
            type={showToken ? "text" : "password"}
            id={`${platform}-token`}
            className="flex-1 min-w-0 block w-full px-3 py-2 rounded-none rounded-l-md focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm border-gray-300"
            value={token}
            onChange={(e) => setToken(e.target.value)}
            placeholder="Enter access token"
            disabled={!isAdminView}
          />
          <button
            type="button"
            onClick={toggleShowToken}
            className="inline-flex items-center px-3 py-2 border border-l-0 border-gray-300 rounded-r-md bg-gray-50 text-gray-700 text-sm"
            disabled={!isAdminView}
          >
            {showToken ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </button>
        </div>
        {connection && (
          <div className="mt-1 flex items-center">
            <Clock className={`h-4 w-4 mr-1 ${getExpiryStatusClass()}`} />
            <p className={`text-xs ${getExpiryStatusClass()}`}>
              Token expires: {new Date(connection.token_expiry).toLocaleDateString()} ({getExpiryStatus()})
            </p>
          </div>
        )}
      </div>

      {error && (
        <div className="flex items-center text-sm text-red-600">
          <AlertTriangle className="h-4 w-4 mr-1" />
          <span>{error}</span>
        </div>
      )}

      {isAdminView && (
        <div className="flex items-center">
          <button
            onClick={handleSaveToken}
            disabled={!token || saving}
            className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50"
          >
            {saving ? (
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
            ) : (
              <Save className="h-4 w-4 mr-2" />
            )}
            {saving ? 'Saving...' : 'Update Token'}
          </button>
          
          {success && (
            <span className="ml-3 text-sm text-green-600 flex items-center">
              <Check className="h-4 w-4 mr-1" />
              Token updated successfully
            </span>
          )}
        </div>
      )}

      {isAdminView && (
        <div className="bg-blue-50 p-4 rounded-md">
          <div className="flex">
            <div className="flex-shrink-0">
              <AlertTriangle className="h-5 w-5 text-blue-400" />
            </div>
            <div className="ml-3">
              <h3 className="text-sm font-medium text-blue-800">Token Security Note</h3>
              <div className="mt-2 text-sm text-blue-700">
                <p>This token grants access to interact with {platform === 'facebook' ? 'Facebook Page' : 'Instagram Account'}. Protect it and never share it publicly.</p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default TokenManagement;