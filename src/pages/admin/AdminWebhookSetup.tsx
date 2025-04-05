import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { getWebhookConfigs, updateWebhookConfig } from '../../lib/api';
import { WebhookConfig } from '../../types';
import { Webhook, Copy, CheckCircle, Terminal, Globe, AlertTriangle, RefreshCw, Lock } from 'lucide-react';
import LoadingIndicator from '../../components/LoadingIndicator';
import ErrorAlert from '../../components/ErrorAlert';

export default function AdminWebhookSetup() {
  const [webhooks, setWebhooks] = useState<WebhookConfig[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [copySuccess, setCopySuccess] = useState<string | null>(null);
  const [selectedWebhook, setSelectedWebhook] = useState<WebhookConfig | null>(null);
  const [webhookToken, setWebhookToken] = useState('');
  const [savingToken, setSavingToken] = useState(false);
  const [tokenSaveSuccess, setTokenSaveSuccess] = useState(false);

  useEffect(() => {
    loadWebhooks();
  }, []);

  useEffect(() => {
    // When a webhook is selected, update the token input
    if (selectedWebhook) {
      setWebhookToken(selectedWebhook.webhook_token || '');
    } else {
      setWebhookToken('');
    }
  }, [selectedWebhook]);

  const loadWebhooks = async () => {
    try {
      setLoading(true);
      setError(null);
      const configs = await getWebhookConfigs();
      setWebhooks(configs);
      // If there are webhooks, select the first one
      if (configs.length > 0) {
        setSelectedWebhook(configs[0]);
      }
    } catch (err) {
      console.error('Error loading webhook configs:', err);
      setError('Failed to load webhook configurations');
    } finally {
      setLoading(false);
    }
  };

  const copyToClipboard = async (text: string, label: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopySuccess(label);
      setTimeout(() => setCopySuccess(null), 2000);
    } catch (err) {
      console.error('Failed to copy text:', err);
      setError('Failed to copy to clipboard');
    }
  };

  const handleSaveToken = async () => {
    if (!selectedWebhook) return;

    try {
      setSavingToken(true);
      setError(null);
      setTokenSaveSuccess(false);

      // Update the webhook config with the new token
      const updatedWebhook = await updateWebhookConfig(selectedWebhook.id, {
        webhook_token: webhookToken,
        meta_verification_status: webhookToken ? 'verified' : 'pending',
        updated_at: new Date().toISOString()
      });

      // Update local state
      setWebhooks(prevWebhooks => 
        prevWebhooks.map(webhook => 
          webhook.id === selectedWebhook.id ? updatedWebhook : webhook
        )
      );
      setSelectedWebhook(updatedWebhook);
      setTokenSaveSuccess(true);

      // Clear success message after a delay
      setTimeout(() => setTokenSaveSuccess(false), 3000);
    } catch (err) {
      console.error('Error saving webhook token:', err);
      setError('Failed to save webhook token');
    } finally {
      setSavingToken(false);
    }
  };

  const getWebhookStatusBadge = (webhook: WebhookConfig) => {
    if (webhook.is_active && webhook.webhook_token) {
      return (
        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
          <CheckCircle className="h-3 w-3 mr-1" /> Verified & Active
        </span>
      );
    } else if (webhook.webhook_token) {
      return (
        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
          <CheckCircle className="h-3 w-3 mr-1" /> Verified
        </span>
      );
    } else if (webhook.is_active) {
      return (
        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
          <AlertTriangle className="h-3 w-3 mr-1" /> Active (Not Verified)
        </span>
      );
    } else {
      return (
        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
          Inactive
        </span>
      );
    }
  };

  if (loading) {
    return <LoadingIndicator message="Loading webhook configurations..." />;
  }

  return (
    <div className="space-y-6">
      {error && (
        <ErrorAlert
          message="Error"
          details={error}
          onDismiss={() => setError(null)}
        />
      )}

      <div className="bg-white shadow rounded-lg overflow-hidden">
        <div className="px-4 py-5 sm:px-6 border-b border-gray-200">
          <h3 className="text-lg leading-6 font-medium text-gray-900 flex items-center">
            <Webhook className="h-5 w-5 mr-2 text-indigo-600" />
            Webhook Management
          </h3>
          <p className="mt-1 max-w-2xl text-sm text-gray-500">
            Configure and manage webhooks for Meta platforms
          </p>
        </div>

        <div className="px-4 py-5 sm:p-6">
          {webhooks.length === 0 ? (
            <div className="text-center py-6">
              <Webhook className="mx-auto h-12 w-12 text-gray-400" />
              <h3 className="mt-2 text-sm font-medium text-gray-900">No webhooks configured</h3>
              <p className="mt-1 text-sm text-gray-500">
                Get started by setting up a new webhook configuration.
              </p>
              <div className="mt-6">
                <button
                  type="button"
                  className="inline-flex items-center px-4 py-2 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                  onClick={() => loadWebhooks()}
                >
                  <RefreshCw className="-ml-1 mr-2 h-5 w-5" />
                  Refresh List
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-6">
              <div className="sm:flex sm:items-start sm:justify-between">
                <div>
                  <h3 className="text-lg leading-6 font-medium text-gray-900">Webhook Configurations</h3>
                  <p className="mt-1 max-w-2xl text-sm text-gray-500">
                    Select a webhook to manage its verification token
                  </p>
                </div>
              </div>

              <div className="mt-4">
                <label htmlFor="webhook-select" className="block text-sm font-medium text-gray-700">
                  Select Webhook
                </label>
                <select
                  id="webhook-select"
                  className="mt-1 block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm rounded-md"
                  value={selectedWebhook?.id || ''}
                  onChange={(e) => {
                    const selected = webhooks.find(webhook => webhook.id === e.target.value);
                    setSelectedWebhook(selected || null);
                  }}
                >
                  <option value="" disabled>Select a webhook configuration</option>
                  {webhooks.map((webhook) => (
                    <option key={webhook.id} value={webhook.id}>
                      {webhook.webhook_name || webhook.platform || `Webhook ${webhook.id.substring(0, 8)}`}
                    </option>
                  ))}
                </select>
              </div>

              {selectedWebhook && (
                <div className="bg-gray-50 p-4 rounded-lg mt-4">
                  <div className="flex justify-between items-start">
                    <div>
                      <h4 className="text-base font-medium text-gray-900">
                        {selectedWebhook.webhook_name || `Webhook ${selectedWebhook.id.substring(0, 8)}`}
                      </h4>
                      <p className="text-sm text-gray-500">
                        Platform: {selectedWebhook.platform}
                      </p>
                      <div className="mt-2">
                        {getWebhookStatusBadge(selectedWebhook)}
                      </div>
                    </div>
                  </div>
                  
                  <div className="mt-4 space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700">
                        Webhook URL
                      </label>
                      <div className="mt-1 flex rounded-md shadow-sm">
                        <div className="relative flex items-stretch flex-grow">
                          <input
                            type="text"
                            className="focus:ring-indigo-500 focus:border-indigo-500 block w-full rounded-none rounded-l-md sm:text-sm border-gray-300 bg-gray-100"
                            value={selectedWebhook.generated_url || selectedWebhook.webhook_url || ''}
                            readOnly
                          />
                        </div>
                        <button
                          type="button"
                          className="relative inline-flex items-center space-x-2 px-4 py-2 border border-gray-300 text-sm font-medium rounded-r-md text-gray-700 bg-gray-50 hover:bg-gray-100 focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500"
                          onClick={() => copyToClipboard(selectedWebhook.generated_url || selectedWebhook.webhook_url || '', 'URL')}
                        >
                          {copySuccess === 'URL' ? (
                            <CheckCircle className="h-5 w-5 text-green-500" />
                          ) : (
                            <Copy className="h-5 w-5 text-gray-500" />
                          )}
                        </button>
                      </div>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700">
                        Verification Token
                      </label>
                      <div className="mt-1 flex rounded-md shadow-sm">
                        <div className="relative flex items-stretch flex-grow">
                          <input
                            type="text"
                            className="focus:ring-indigo-500 focus:border-indigo-500 block w-full rounded-none rounded-l-md sm:text-sm border-gray-300 bg-gray-100"
                            value={selectedWebhook.verification_token || ''}
                            readOnly
                          />
                        </div>
                        <button
                          type="button"
                          className="relative inline-flex items-center space-x-2 px-4 py-2 border border-gray-300 text-sm font-medium rounded-r-md text-gray-700 bg-gray-50 hover:bg-gray-100 focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500"
                          onClick={() => copyToClipboard(selectedWebhook.verification_token || '', 'Verification')}
                        >
                          {copySuccess === 'Verification' ? (
                            <CheckCircle className="h-5 w-5 text-green-500" />
                          ) : (
                            <Copy className="h-5 w-5 text-gray-500" />
                          )}
                        </button>
                      </div>
                    </div>

                    <div className="border-t border-gray-200 pt-4 mt-6">
                      <h4 className="text-base font-medium text-gray-900 flex items-center">
                        <Lock className="h-4 w-4 mr-1 text-indigo-600" />
                        Meta Webhook Token
                      </h4>
                      <p className="text-sm text-gray-500 mt-1 mb-4">
                        After Meta verifies your webhook, enter the generated token here to complete setup.
                      </p>
                      
                      <div>
                        <label htmlFor="webhook-token" className="block text-sm font-medium text-gray-700 mb-1">
                          Webhook Access Token
                        </label>
                        <div className="mt-1 flex rounded-md shadow-sm">
                          <input
                            type="text"
                            id="webhook-token"
                            className="focus:ring-indigo-500 focus:border-indigo-500 block w-full rounded-md sm:text-sm border-gray-300"
                            placeholder="Enter token provided by Meta"
                            value={webhookToken}
                            onChange={(e) => setWebhookToken(e.target.value)}
                          />
                        </div>
                        <p className="mt-2 text-xs text-gray-500">
                          This token is provided by Meta after successful webhook verification and is required for future API calls.
                        </p>
                      </div>

                      <div className="mt-4 flex items-center">
                        <button
                          type="button"
                          className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50"
                          onClick={handleSaveToken}
                          disabled={savingToken}
                        >
                          {savingToken ? (
                            <>
                              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                              Saving...
                            </>
                          ) : (
                            'Save Token'
                          )}
                        </button>
                        
                        {tokenSaveSuccess && (
                          <span className="ml-3 text-sm text-green-600 flex items-center">
                            <CheckCircle className="h-4 w-4 mr-1" />
                            Token saved successfully
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="bg-gray-50 p-4 rounded-md mt-4">
                      <h5 className="text-sm font-medium text-gray-900 flex items-center">
                        <Terminal className="h-4 w-4 mr-1 text-gray-500" />
                        Where to find the webhook token
                      </h5>
                      <ol className="mt-2 text-xs text-gray-600 list-decimal list-inside space-y-1">
                        <li>Go to your Meta App Dashboard</li>
                        <li>Navigate to Products &gt; Messenger/Instagram &gt; Settings</li>
                        <li>Find the "Webhooks" section</li>
                        <li>After successful verification, Meta will provide a token</li>
                        <li>Copy and paste that token here</li>
                      </ol>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}