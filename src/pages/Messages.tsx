import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { MessageCircle, Facebook, Instagram, User, Bot, ArrowRight } from 'lucide-react';
import { getConversations } from '../lib/api';
import { supabase } from '../lib/supabase';
import LoadingIndicator from '../components/LoadingIndicator';
import ErrorAlert from '../components/ErrorAlert';
import type { Conversation, LoadingState, ErrorState } from '../types';

export default function Messages() {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [loadingState, setLoadingState] = useState<LoadingState>('idle');
  const [error, setError] = useState<ErrorState | null>(null);

  useEffect(() => {
    async function loadConversations() {
      setLoadingState('loading');
      try {
        const conversationsData = await getConversations();
        setConversations(conversationsData);
        setLoadingState('success');
      } catch (err) {
        console.error('Error loading conversations:', err);
        setError({
          message: 'Failed to load conversations',
          details: err instanceof Error ? err.message : 'Unknown error'
        });
        setLoadingState('error');
      }
    }

    loadConversations();
  }, []);

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString() + ' ' + date.toLocaleTimeString();
  };

  const getPlatformIcon = (platform: string) => {
    switch (platform) {
      case 'facebook':
        return <Facebook className="h-5 w-5 text-blue-600" />;
      case 'instagram':
        return <Instagram className="h-5 w-5 text-pink-600" />;
      default:
        return <MessageCircle className="h-5 w-5 text-gray-600" />;
    }
  };

  if (loadingState === 'loading') {
    return <LoadingIndicator message="Loading conversations..." />;
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-xl font-bold text-gray-900">Messages</h2>
      </div>

      {error && (
        <ErrorAlert
          message={error.message}
          details={error.details}
          onDismiss={() => setError(null)}
        />
      )}

      <div className="bg-white shadow overflow-hidden sm:rounded-md">
        <ul className="divide-y divide-gray-200">
          {conversations.length === 0 ? (
            <li className="p-10 text-center">
              <MessageCircle className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <p className="text-gray-500">No messages yet</p>
              <p className="text-sm text-gray-400 mt-2">
                Messages from your connected social accounts will appear here
              </p>
            </li>
          ) : (
            conversations.map((conversation) => (
              <li key={conversation.id}>
                <Link
                  to={`/messages/${conversation.id}`}
                  className="block hover:bg-gray-50"
                >
                  <div className="px-4 py-4 sm:px-6">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center">
                        {getPlatformIcon(conversation.platform)}
                        <p className="ml-2 text-sm font-medium text-indigo-600 truncate">
                          {conversation.participant_name || `User ${conversation.participant_id.slice(0, 8)}`}
                        </p>
                      </div>
                      <div className="ml-2 flex-shrink-0 flex">
                        <p className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-green-100 text-green-800">
                          {conversation.platform}
                        </p>
                      </div>
                    </div>
                    <div className="mt-2 sm:flex sm:justify-between">
                      <div className="sm:flex">
                        <p className="flex items-center text-sm text-gray-500">
                          {conversation.latest_message ? (
                            <>
                              {conversation.latest_message.sender_type === 'user' ? (
                                <User className="h-4 w-4 text-gray-400 mr-1" />
                              ) : (
                                <Bot className="h-4 w-4 text-gray-400 mr-1" />
                              )}
                              <span className="truncate max-w-xs">
                                {conversation.latest_message.content}
                              </span>
                            </>
                          ) : (
                            <span className="text-gray-400">No messages</span>
                          )}
                        </p>
                      </div>
                      <div className="mt-2 flex items-center text-sm text-gray-500 sm:mt-0">
                        <p>{formatDate(conversation.last_message_at)}</p>
                        <ArrowRight className="ml-1 h-4 w-4 text-gray-400" />
                      </div>
                    </div>
                  </div>
                </Link>
              </li>
            ))
          )}
        </ul>
      </div>
    </div>
  );
}