import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Send, Facebook, Instagram, User, Bot, AlertTriangle, RefreshCw } from 'lucide-react';
import { getConversation, getMessages, createMessage } from '../lib/api';
import { sendMessageToPlatform, processMessageWithVoiceflow } from '../lib/voiceflow';
import { supabase } from '../lib/supabase';
import { useAsyncCall, useLoadingWithTimeout } from '../lib/errorHandling';
import LoadingIndicator from '../components/LoadingIndicator';
import ErrorAlert from '../components/ErrorAlert';
import RetryableErrorBoundary from '../components/RetryableErrorBoundary';
import type { Conversation, Message, LoadingState, ErrorState } from '../types';

export default function MessageDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [conversation, setConversation] = useState<Conversation | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [loadingState, setLoadingState] = useState<LoadingState>('idle');
  const [sendingState, setSendingState] = useState<LoadingState>('idle');
  const [error, setError] = useState<ErrorState | null>(null);
  const [isRetrying, setIsRetrying] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Use the loading with timeout hook
  const { loading: isSending, setLoading: setSending, timedOut: sendingTimedOut } = useLoadingWithTimeout(15000);

  // Use custom hook for async calls with retry
  const messageLoader = useAsyncCall<Message[]>(
    getMessages,
    [],
    3, // max retries
    1500 // retry delay
  );

  useEffect(() => {
    if (!id) return;

    async function loadConversationData() {
      setLoadingState('loading');
      try {
        const conversationData = await getConversation(id);
        setConversation(conversationData);
        
        // Load messages with retry capability
        const messagesData = await messageLoader.execute(id);
        setMessages(messagesData);
        
        setLoadingState('success');
      } catch (err) {
        console.error('Error loading conversation data:', err);
        setError({
          message: 'Failed to load conversation',
          details: err instanceof Error ? err.message : 'Unknown error'
        });
        setLoadingState('error');
      }
    }

    loadConversationData();
  }, [id, messageLoader]);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const handleRetry = async () => {
    if (!id) return;
    
    setIsRetrying(true);
    setError(null);
    
    try {
      const conversationData = await getConversation(id);
      setConversation(conversationData);
      
      const messagesData = await getMessages(id);
      setMessages(messagesData);
      
      setLoadingState('success');
    } catch (err) {
      console.error('Error retrying load:', err);
      setError({
        message: 'Failed to reload conversation',
        details: err instanceof Error ? err.message : 'Unknown error'
      });
      setLoadingState('error');
    } finally {
      setIsRetrying(false);
    }
  };

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!id || !conversation || !newMessage.trim() || isSending) return;

    setSending(true);
    setSendingState('loading');
    
    try {
      // 1. Add the message to the database
      const sentMessage = await createMessage({
        conversation_id: id,
        content: newMessage,
        sender_type: 'assistant',
        sent_at: new Date().toISOString()
      });
      
      // 2. Update the UI with the new message
      setMessages(prevMessages => [...prevMessages, sentMessage]);
      setNewMessage('');
      
      // 3. Send the message to the social platform
      const success = await sendMessageToPlatform(conversation, newMessage);
      
      if (!success) {
        // Handle failed send - in a real app, you might want to mark the message as failed
        console.warn('Failed to send message to platform API');
      }
      
      setSendingState('success');
    } catch (err) {
      console.error('Error sending message:', err);
      setError({
        message: 'Failed to send message',
        details: err instanceof Error ? err.message : 'Unknown error'
      });
      setSendingState('error');
    } finally {
      setSending(false);
    }
  };

  const handleReceiveMessage = async (userMessage: string) => {
    if (!id || !conversation) return;
    
    // In a real app, this would be triggered by a webhook
    // For demo purposes, we'll simulate receiving a user message
    
    try {
      // 1. Add the user message to the database
      const receivedMessage = await createMessage({
        conversation_id: id,
        content: userMessage,
        sender_type: 'user',
        sent_at: new Date().toISOString()
      });
      
      // 2. Update the UI with the new message
      setMessages(prevMessages => [...prevMessages, receivedMessage]);
      
      // 3. Process the message with Voiceflow
      const response = await processMessageWithVoiceflow(conversation, userMessage);
      
      if (!response) {
        throw new Error('Failed to get response from Voiceflow');
      }
      
      // 4. Add the assistant response to the database
      const assistantMessage = await createMessage({
        conversation_id: id,
        content: response,
        sender_type: 'assistant',
        sent_at: new Date().toISOString()
      });
      
      // 5. Update the UI with the assistant's message
      setMessages(prevMessages => [...prevMessages, assistantMessage]);
      
    } catch (err) {
      console.error('Error processing received message:', err);
      setError({
        message: 'Failed to process message',
        details: err instanceof Error ? err.message : 'Unknown error'
      });
    }
  };

  const formatTime = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString();
  };

  const getPlatformIcon = (platform?: string) => {
    switch (platform) {
      case 'facebook':
        return <Facebook className="h-5 w-5 text-blue-600" />;
      case 'instagram':
        return <Instagram className="h-5 w-5 text-pink-600" />;
      default:
        return null;
    }
  };

  if (loadingState === 'loading') {
    return <LoadingIndicator message="Loading conversation..." />;
  }

  if (!conversation && loadingState === 'success') {
    return (
      <div className="text-center py-10">
        <p className="text-gray-500">Conversation not found</p>
        <button
          onClick={() => navigate('/messages')}
          className="mt-4 inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-indigo-700 bg-indigo-100 hover:bg-indigo-200"
        >
          <ArrowLeft className="h-5 w-5 mr-2" />
          Back to Messages
        </button>
      </div>
    );
  }

  return (
    <RetryableErrorBoundary onRetry={handleRetry} maxRetries={3}>
      <div className="flex flex-col h-[calc(100vh-10rem)] bg-white shadow-sm rounded-lg">
        {/* Header */}
        <div className="px-4 py-3 border-b border-gray-200 flex items-center">
          <button
            onClick={() => navigate('/messages')}
            className="mr-3 text-gray-500 hover:text-gray-700"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
          <div className="flex items-center">
            {getPlatformIcon(conversation?.platform)}
            <span className="ml-2 font-medium">
              {conversation?.participant_name || `User ${conversation?.participant_id.slice(0, 8)}`}
            </span>
          </div>
        </div>

        {/* Messages area */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {error && (
            <div className="mb-4">
              <ErrorAlert
                message={error.message}
                details={error.details}
                onDismiss={() => setError(null)}
              />
              <div className="mt-2 flex justify-center">
                <button
                  onClick={handleRetry}
                  disabled={isRetrying}
                  className="inline-flex items-center px-3 py-1 border border-transparent text-sm rounded-md text-indigo-700 bg-indigo-100 hover:bg-indigo-200 disabled:opacity-50"
                >
                  {isRetrying ? (
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-indigo-700 mr-2"></div>
                  ) : (
                    <RefreshCw className="h-4 w-4 mr-1" />
                  )}
                  {isRetrying ? 'Retrying...' : 'Retry'}
                </button>
              </div>
            </div>
          )}

          {messages.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-center">
              <p className="text-gray-500 mb-4">No messages in this conversation yet</p>
              
              {/* Demo buttons to simulate receiving messages - would not exist in production */}
              <div className="space-y-2">
                <p className="text-sm text-gray-400">Demo: Simulate receiving messages</p>
                <div className="flex space-x-2">
                  <button
                    onClick={() => handleReceiveMessage("Hello, I need some help with my order.")}
                    className="px-3 py-1 text-xs bg-gray-100 text-gray-600 rounded hover:bg-gray-200"
                  >
                    Simulate: Help request
                  </button>
                  <button
                    onClick={() => handleReceiveMessage("What are your business hours?")}
                    className="px-3 py-1 text-xs bg-gray-100 text-gray-600 rounded hover:bg-gray-200"
                  >
                    Simulate: Question
                  </button>
                </div>
              </div>
            </div>
          ) : (
            messages.map((message, i) => {
              const showDate = i === 0 || 
                formatDate(messages[i-1].sent_at) !== formatDate(message.sent_at);
              
              return (
                <React.Fragment key={message.id}>
                  {showDate && (
                    <div className="flex justify-center my-4">
                      <span className="text-xs text-gray-500 bg-gray-100 px-2 py-1 rounded-full">
                        {formatDate(message.sent_at)}
                      </span>
                    </div>
                  )}
                  <div className={`flex ${message.sender_type === 'assistant' ? 'justify-end' : 'justify-start'}`}>
                    <div className={`
                      max-w-[70%] px-4 py-2 rounded-lg
                      ${message.sender_type === 'assistant' 
                        ? 'bg-indigo-600 text-white' 
                        : 'bg-gray-100 text-gray-800'}
                    `}>
                      <div className="flex items-center mb-1">
                        {message.sender_type === 'user' ? (
                          <User className="h-4 w-4 mr-1" />
                        ) : (
                          <Bot className="h-4 w-4 mr-1" />
                        )}
                        <span className="text-xs">
                          {message.sender_type === 'user' ? 'User' : 'Assistant'} • {formatTime(message.sent_at)}
                        </span>
                      </div>
                      <p className="whitespace-pre-wrap">{message.content}</p>
                    </div>
                  </div>
                </React.Fragment>
              );
            })
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Message input */}
        <form onSubmit={handleSendMessage} className="border-t border-gray-200 p-4">
          <div className="flex items-center">
            <input
              type="text"
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
              placeholder="Type your message..."
              className="flex-1 focus:ring-indigo-500 focus:border-indigo-500 block w-full rounded-md sm:text-sm border-gray-300"
              disabled={isSending}
            />
            <button
              type="submit"
              className="ml-3 inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50"
              disabled={!newMessage.trim() || isSending}
            >
              {isSending ? (
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
              ) : (
                <Send className="h-4 w-4" />
              )}
            </button>
          </div>
          
          {/* Timed out message */}
          {sendingTimedOut && (
            <div className="mt-2 flex items-center text-sm text-amber-600">
              <AlertTriangle className="h-4 w-4 mr-1" />
              <span>
                Taking longer than expected... but still trying to send your message.
              </span>
            </div>
          )}
        </form>
      </div>
    </RetryableErrorBoundary>
  );
}