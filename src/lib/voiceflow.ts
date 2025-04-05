import axios from 'axios';
import { supabase } from './supabase';
import { getVoiceflowMappings, getVoiceflowApiKeyByUserId, createMessage, trackApiCall, checkRateLimit } from './api';
import { captureError } from './sentry';
import type { VoiceflowMapping, Conversation, Message } from '../types';

// Define rate limits for Voiceflow API
const RATE_LIMITS = {
  interact: 100 // 100 calls per day
};

// Cache the Voiceflow API version to avoid repeated lookups
let cachedVoiceflowConfig: {
  projectId: string;
  versionId: string;
  clientId: string;
  apiKey?: string;
} | null = null;

// Set up axios instance for Voiceflow API
const voiceflowApi = axios.create({
  baseURL: 'https://general-runtime.voiceflow.com',
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 15000 // 15 second timeout (increased from 10s)
});

/**
 * Initialize the Voiceflow configuration for a user
 */
export async function initVoiceflowConfig(): Promise<boolean> {
  try {
    // Clear cache
    cachedVoiceflowConfig = null;
    
    // Get the user
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      console.log('User not authenticated during Voiceflow init');
      return false;
    }
    
    // Get the Voiceflow mappings - handle gracefully if there are errors
    try {
      const mappings = await getVoiceflowMappings();
      if (!mappings || mappings.length === 0) {
        console.log('No Voiceflow mapping found for user');
        return false;
      }
      
      const mapping = mappings[0];
      const config = mapping.flowbridge_config;
      
      if (!config?.voiceflow?.project_id) {
        console.error('Invalid Voiceflow configuration');
        return false;
      }
      
      // Try to get API key if available (for admin users)
      let apiKey: string | undefined;
      try {
        const apiKeyData = await getVoiceflowApiKeyByUserId(user.id);
        if (apiKeyData) {
          apiKey = apiKeyData.api_key;
        }
      } catch (keyError) {
        console.log('Error getting API key, continuing with default configuration:', keyError);
      }
      
      // Cache the configuration
      cachedVoiceflowConfig = {
        projectId: config.voiceflow.project_id,
        versionId: config.voiceflow.version_id || 'latest',
        clientId: user.id,
        apiKey: apiKey
      };
      
      // In production, set up the Voiceflow API key
      if (import.meta.env.PROD && apiKey) {
        voiceflowApi.defaults.headers.common['Authorization'] = `Bearer ${apiKey}`;
      } else if (import.meta.env.PROD) {
        // If no user-specific API key, use the environment variable key if available
        if (import.meta.env.VITE_VOICEFLOW_API_KEY) {
          voiceflowApi.defaults.headers.common['Authorization'] = 
            `Bearer ${import.meta.env.VITE_VOICEFLOW_API_KEY}`;
        } else {
          console.warn('No Voiceflow API key found in environment variables or user configuration');
        }
      }
      
      console.log('Voiceflow configuration initialized successfully');
      return true;
    } catch (mappingError) {
      console.error('Error fetching Voiceflow mappings:', mappingError);
      return false;
    }
  } catch (error) {
    console.error('Error initializing Voiceflow configuration:', error);
    captureError(error, { context: 'initVoiceflowConfig' });
    return false;
  }
}

/**
 * Process a message through Voiceflow and get the response
 */
export async function processMessageWithVoiceflow(
  conversation: Conversation,
  messageContent: string,
  retryCount = 0
): Promise<string | null> {
  try {
    // Get the user
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      throw new Error('User not authenticated');
    }
    
    // Check rate limits
    const withinRateLimit = await checkRateLimit(
      user.id,
      'voiceflow',
      'interact',
      RATE_LIMITS.interact
    );
    
    if (!withinRateLimit) {
      throw new Error('Voiceflow API rate limit reached. Please try again tomorrow.');
    }
    
    // Initialize config if not cached
    if (!cachedVoiceflowConfig) {
      const initialized = await initVoiceflowConfig();
      if (!initialized) {
        throw new Error('Failed to initialize Voiceflow configuration');
      }
    }
    
    // Track this API call
    await trackApiCall(user.id, 'voiceflow', 'interact');
    
    // In a production environment, make the actual API call to Voiceflow
    if (import.meta.env.PROD) {
      try {
        // Construct user context for Voiceflow
        const userContext = {
          participantId: conversation.participant_id,
          participantName: conversation.participant_name,
          platform: conversation.platform
        };
        
        // Add cancellation token for timeout handling
        const source = axios.CancelToken.source();
        const timeout = setTimeout(() => {
          source.cancel('Request timed out');
        }, 14000); // Just under the axios timeout
        
        // Make API call to Voiceflow
        const response = await voiceflowApi.post(`/state/user/${user.id}/interact`, {
          action: {
            type: 'text',
            payload: messageContent
          },
          config: {
            tts: false,
            stripSSML: true
          },
          state: {
            variables: userContext
          }
        }, { cancelToken: source.token });
        
        // Clear timeout
        clearTimeout(timeout);
        
        // Process Voiceflow response - extract text from the response
        if (response.data && Array.isArray(response.data)) {
          // Find text responses in the Voiceflow response array
          const textResponses = response.data
            .filter(item => item.type === 'text')
            .map(item => item.payload?.message || '');
          
          if (textResponses.length > 0) {
            // Join multiple text responses if any
            return textResponses.join('\n\n');
          }
        }
        
        // No valid response found
        throw new Error('No valid response from Voiceflow');
      } catch (error) {
        // Handle API errors
        console.error('Voiceflow API error:', error);
        captureError(error, { 
          context: 'processMessageWithVoiceflow',
          conversation: {
            id: conversation.id,
            platform: conversation.platform
          }
        });
        
        // Retry logic
        if (retryCount < 2) {
          console.log(`Retrying Voiceflow API call (attempt ${retryCount + 1})`);
          return processMessageWithVoiceflow(conversation, messageContent, retryCount + 1);
        }
        
        throw error;
      }
    }
    
    // For development or when not in production: Simulate Voiceflow response
    // Simulate API call with delay
    await new Promise(resolve => setTimeout(resolve, 500));
    
    // Construct user context
    const userContext = {
      participantId: conversation.participant_id,
      participantName: conversation.participant_name,
      platform: conversation.platform
    };
    
    // Simulate Voiceflow response
    let response: string;
    
    // Simulate potential errors (for testing error handling)
    const shouldSimulateError = Math.random() < 0.05; // 5% chance of error
    
    if (shouldSimulateError && retryCount < 2) {
      throw new Error('Simulated Voiceflow API error');
    }
    
    // Generate a response based on the message content
    if (messageContent.toLowerCase().includes('hello') || 
        messageContent.toLowerCase().includes('hi') ||
        messageContent.toLowerCase().includes('hey')) {
      response = `Hi there! How can I help you today?`;
    } else if (messageContent.toLowerCase().includes('help')) {
      response = `I'd be happy to help! What do you need assistance with?`;
    } else if (messageContent.toLowerCase().includes('thank')) {
      response = `You're very welcome! Is there anything else I can help with?`;
    } else if (messageContent.toLowerCase().includes('bye') || 
               messageContent.toLowerCase().includes('goodbye')) {
      response = `Goodbye! Have a great day!`;
    } else {
      // Generic response
      const genericResponses = [
        `I understand you're asking about "${messageContent.substring(0, 30)}...". Let me help with that.`,
        `Thanks for reaching out! I'm processing your request about "${messageContent.substring(0, 20)}..."`,
        `I'd be happy to assist with your question. Let me look into that for you.`,
        `Great question! Here's what I know about this topic.`
      ];
      response = genericResponses[Math.floor(Math.random() * genericResponses.length)];
    }
    
    // Add platform-specific information to the response
    if (conversation.platform === 'facebook') {
      response += `\n\n(Message sent via Facebook)`;
    } else if (conversation.platform === 'instagram') {
      response += `\n\n(Message sent via Instagram)`;
    }
    
    return response;
  } catch (error) {
    console.error('Error processing message with Voiceflow:', error);
    captureError(error, { 
      context: 'processMessageWithVoiceflow',
      messageContent,
      retryCount
    });
    
    // Retry logic
    if (retryCount < 2) {
      console.log(`Retrying Voiceflow API call (attempt ${retryCount + 1})`);
      return processMessageWithVoiceflow(conversation, messageContent, retryCount + 1);
    }
    
    // If all retries fail, provide a fallback response
    return "I'm sorry, I'm having trouble processing your request at the moment. Please try again in a few moments.";
  }
}

/**
 * Handle an incoming message from a social platform
 */
export async function handleIncomingMessage(
  platform: 'facebook' | 'instagram', 
  externalId: string,
  participantId: string,
  participantName: string | undefined,
  messageContent: string,
  externalMessageId?: string
): Promise<Message | null> {
  try {
    // Get the user
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      throw new Error('User not authenticated');
    }
    
    // Look for an existing conversation or create a new one
    const { data: existingConversations, error: conversationError } = await supabase
      .from('conversations')
      .select('*')
      .eq('user_id', user.id)
      .eq('platform', platform)
      .eq('external_id', externalId)
      .limit(1);
      
    if (conversationError) {
      console.error(`Error fetching conversation for ${platform}/${externalId}:`, conversationError);
      throw conversationError;
    }
    
    let conversationId: string;
    
    if (existingConversations && existingConversations.length > 0) {
      // Update existing conversation
      conversationId = existingConversations[0].id;
      await supabase
        .from('conversations')
        .update({ 
          last_message_at: new Date().toISOString(),
          participant_name: participantName // Update name in case it changed
        })
        .eq('id', conversationId);
    } else {
      // Create new conversation
      const { data: newConversation, error: newConversationError } = await supabase
        .from('conversations')
        .insert([{
          user_id: user.id,
          platform,
          external_id: externalId,
          participant_id: participantId,
          participant_name: participantName,
          last_message_at: new Date().toISOString()
        }])
        .select();
        
      if (newConversationError) {
        console.error(`Error creating conversation for ${platform}/${externalId}:`, newConversationError);
        throw newConversationError;
      }
      
      if (!newConversation || newConversation.length === 0) {
        throw new Error('Failed to create conversation');
      }
      
      conversationId = newConversation[0].id;
    }
    
    // Store the user's message
    const userMessage = await createMessage({
      conversation_id: conversationId,
      content: messageContent,
      sender_type: 'user',
      external_id: externalMessageId,
      sent_at: new Date().toISOString()
    });
    
    // Get the conversation
    const { data: conversation, error: getConversationError } = await supabase
      .from('conversations')
      .select('*')
      .eq('id', conversationId)
      .single();
      
    if (getConversationError) {
      console.error(`Error fetching conversation details for ${conversationId}:`, getConversationError);
      throw getConversationError;
    }
    
    // Process the message with Voiceflow
    const voiceflowResponse = await processMessageWithVoiceflow(
      conversation,
      messageContent
    );
    
    if (!voiceflowResponse) {
      throw new Error('Failed to get response from Voiceflow');
    }
    
    // Store the assistant's response
    const assistantMessage = await createMessage({
      conversation_id: conversationId,
      content: voiceflowResponse,
      sender_type: 'assistant',
      sent_at: new Date().toISOString()
    });
    
    // In production, send the message via the appropriate platform API
    if (import.meta.env.PROD) {
      const success = await sendMessageToPlatform(conversation, voiceflowResponse);
      if (!success) {
        console.warn(`Failed to send message to ${platform}`);
      }
    }
    
    return assistantMessage;
  } catch (error) {
    console.error('Error handling incoming message:', error);
    captureError(error, { 
      context: 'handleIncomingMessage', 
      platform, 
      externalId 
    });
    return null;
  }
}

// Set up axios instance for Meta API
const metaApi = axios.create({
  baseURL: 'https://graph.facebook.com/v18.0',
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 15000 // 15 second timeout
});

/**
 * Send a message to a social platform
 */
export async function sendMessageToPlatform(
  conversation: Conversation,
  message: string
): Promise<boolean> {
  try {
    // Get the user
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      throw new Error('User not authenticated');
    }
    
    // Get the social connection for this platform
    const { data: connections, error: connectionError } = await supabase
      .from('social_connections')
      .select('*')
      .eq('user_id', user.id);
      
    if (connectionError) {
      console.error(`Error fetching social connections for user ${user.id}:`, connectionError);
      throw connectionError;
    }
    
    // Find the right connection based on platform
    let connection = null;
    if (conversation.platform === 'facebook') {
      connection = connections.find(c => c.fb_page_id);
    } else if (conversation.platform === 'instagram') {
      connection = connections.find(c => c.ig_account_id);
    }
    
    if (!connection) {
      throw new Error(`No ${conversation.platform} connection found`);
    }
    
    // In production environment, make actual API calls
    if (import.meta.env.PROD) {
      // Add cancellation token for timeout handling
      const source = axios.CancelToken.source();
      const timeout = setTimeout(() => {
        source.cancel('Request timed out');
      }, 14000); // Just under the axios timeout
      
      try {
        if (conversation.platform === 'facebook') {
          // Send to Facebook
          await metaApi.post(`/${connection.fb_page_id}/messages`, {
            recipient: { id: conversation.participant_id },
            message: { text: message },
            messaging_type: 'RESPONSE'
          }, {
            params: { access_token: connection.access_token },
            cancelToken: source.token
          });
        } else if (conversation.platform === 'instagram') {
          // Send to Instagram
          await metaApi.post(`/${connection.ig_account_id}/messages`, {
            recipient: { id: conversation.participant_id },
            message: { text: message },
            messaging_type: 'RESPONSE'
          }, {
            params: { access_token: connection.access_token },
            cancelToken: source.token
          });
        }
        
        // Clear timeout if successful
        clearTimeout(timeout);
      } catch (error) {
        // Clear timeout
        clearTimeout(timeout);
        
        // Check if it was a timeout error
        if (axios.isCancel(error)) {
          console.error(`Request to ${conversation.platform} was cancelled:`, error.message);
        } else {
          console.error(`Error sending message to ${conversation.platform}:`, error);
        }
        
        throw error;
      }
    } else {
      // For development: Log the message
      console.log(`[${conversation.platform.toUpperCase()}] Sending message to ${conversation.participant_id}:`, message);
      
      // Simulate API call with delay
      await new Promise(resolve => setTimeout(resolve, 500));
    }
    
    // Return success
    return true;
  } catch (error) {
    console.error(`Error sending message to ${conversation.platform}:`, error);
    captureError(error, { 
      context: 'sendMessageToPlatform',
      platform: conversation.platform,
      conversationId: conversation.id
    });
    return false;
  }
}

/**
 * Get knowledge base for a Voiceflow project
 */
export async function getVoiceflowKnowledgeBase(
  projectId: string
): Promise<any | null> {
  try {
    // In production, use the actual Voiceflow API to get the knowledge base
    if (import.meta.env.PROD && cachedVoiceflowConfig?.apiKey) {
      const response = await axios.get(`https://api.voiceflow.com/v2/knowledge/${projectId}`, {
        headers: {
          Authorization: `Bearer ${cachedVoiceflowConfig.apiKey}`
        },
        timeout: 15000
      });
      
      return response.data;
    }
    
    // For development, return mock data
    return {
      id: projectId,
      name: 'Sample Knowledge Base',
      documents: [
        { id: 'doc1', title: 'Product Information', type: 'text', updatedAt: new Date().toISOString() },
        { id: 'doc2', title: 'FAQ', type: 'text', updatedAt: new Date().toISOString() },
        { id: 'doc3', title: 'Company Policies', type: 'text', updatedAt: new Date().toISOString() }
      ]
    };
  } catch (error) {
    console.error('Error fetching Voiceflow knowledge base:', error);
    captureError(error, { context: 'getVoiceflowKnowledgeBase', projectId });
    return null;
  }
}

/**
 * Update knowledge base document for a Voiceflow project
 */
export async function updateVoiceflowKnowledgeDocument(
  projectId: string,
  documentId: string,
  content: string
): Promise<boolean> {
  try {
    // In production, use the actual Voiceflow API to update the knowledge document
    if (import.meta.env.PROD && cachedVoiceflowConfig?.apiKey) {
      await axios.put(`https://api.voiceflow.com/v2/knowledge/${projectId}/documents/${documentId}`, {
        content
      }, {
        headers: {
          Authorization: `Bearer ${cachedVoiceflowConfig.apiKey}`,
          'Content-Type': 'application/json'
        },
        timeout: 15000
      });
      
      return true;
    }
    
    // For development, simulate success
    console.log(`[DEV] Updated document ${documentId} in project ${projectId} with content: ${content.substring(0, 50)}...`);
    return true;
  } catch (error) {
    console.error('Error updating Voiceflow knowledge document:', error);
    captureError(error, { 
      context: 'updateVoiceflowKnowledgeDocument', 
      projectId,
      documentId 
    });
    return false;
  }
}