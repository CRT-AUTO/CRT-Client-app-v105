// This is a Netlify serverless function that handles incoming webhook events from Meta platforms
// It processes messages from Facebook and Instagram and forwards them to the AI assistant

const { createClient } = require('@supabase/supabase-js');
const axios = require('axios');
const { 
  processMetaMessage, 
  processInstagramMessage, 
  prepareVoiceflowRequest, 
  formatVoiceflowResponse 
} = require('./message-processor');
const {
  retryWithBackoff,
  isTransientError,
  saveToDeadLetterQueue,
  processError
} = require('./error-recovery');
const {
  queueMessage,
  updateProcessingStatus,
  processPendingMessages
} = require('./message-queue');
const {
  getOrCreateSession,
  updateSessionContext,
  linkSessionToConversation,
  extendSession,
  prepareVoiceflowContext
} = require('./session-manager');
const {
  validateWebhook
} = require('./webhook-security');

// Initialize Supabase client with error handling
let supabase = null;
try {
  const supabaseUrl = process.env.VITE_SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY;
  
  if (supabaseUrl && supabaseServiceKey) {
    supabase = createClient(supabaseUrl, supabaseServiceKey);
    console.log("Supabase client initialized successfully in webhook handler");
  } else {
    console.warn(`Missing Supabase credentials. URL: ${supabaseUrl ? 'Present' : 'Missing'}, Service Key: ${supabaseServiceKey ? 'Present' : 'Missing'}`);
  }
} catch (error) {
  console.error('Error initializing Supabase client:', error);
}

// Process incoming messages from Meta
async function processMessage(userId, platform, senderId, recipientId, message, timestamp) {
  try {
    // Make sure Supabase is initialized
    if (!supabase) {
      throw new Error('Database connection is not available');
    }
    
    // Use retry with backoff for finding the social connection
    const getSocialConnection = async () => {
      // Determine which field to check based on platform
      const fieldToCheck = platform === 'facebook' ? 'fb_page_id' : 'ig_account_id';
      
      // Log the query parameters for debugging
      console.log(`Looking for ${platform} connection for user ${userId}, ${fieldToCheck}=${recipientId}`);
      
      const { data: connections, error: connectionError } = await supabase
        .from('social_connections')
        .select('*')
        .eq('user_id', userId);
        
      if (connectionError) {
        console.error(`Error fetching social connections: ${connectionError.message}`);
        throw connectionError;
      }
      
      if (!connections || connections.length === 0) {
        throw new Error(`No social connections found for user ${userId}`);
      }
      
      // Find the connection that matches the platform and recipient ID
      const connection = connections.find(conn => conn[fieldToCheck] === recipientId);
      
      if (!connection) {
        // Log all available connections for debugging
        console.error(`Available connections for user ${userId}:`, 
          connections.map(c => ({ 
            id: c.id, 
            fb_page_id: c.fb_page_id, 
            ig_account_id: c.ig_account_id 
          }))
        );
        
        throw new Error(`No ${platform} connection found for user ${userId}, page ID ${recipientId}`);
      }
      
      return connection;
    };
    
    const connection = await retryWithBackoff(getSocialConnection, {
      maxRetries: 3,
      initialDelay: 300,
      shouldRetry: (error) => isTransientError(error)
    });
    
    // Get or create a session for this user and participant
    const session = await getOrCreateSession(userId, senderId, platform);
    
    // Find or create conversation with retry
    const getOrCreateConversation = async () => {
      let { data: conversations, error: conversationError } = await supabase
        .from('conversations')
        .select('*')
        .eq('user_id', userId)
        .eq('platform', platform)
        .eq('external_id', senderId);
        
      if (conversationError) throw conversationError;
      
      if (!conversations || conversations.length === 0) {
        // Create new conversation
        const { data: newConversation, error: createError } = await supabase
          .from('conversations')
          .insert([{
            user_id: userId,
            platform,
            external_id: senderId,
            participant_id: senderId,
            participant_name: null,
            last_message_at: new Date(timestamp).toISOString(),
            session_id: session.id  // Link to the session
          }])
          .select();
          
        if (createError) throw createError;
        if (!newConversation || newConversation.length === 0) {
          throw new Error('Failed to create conversation');
        }
        
        return newConversation[0];
      } else {
        // Update last message timestamp
        await supabase
          .from('conversations')
          .update({ 
            last_message_at: new Date(timestamp).toISOString(),
            session_id: session.id  // Update session link
          })
          .eq('id', conversations[0].id);
          
        return conversations[0];
      }
    };
    
    const conversation = await retryWithBackoff(getOrCreateConversation, {
      maxRetries: 3,
      initialDelay: 300,
      shouldRetry: (error) => isTransientError(error)
    });
    
    const conversationId = conversation.id;
    
    // Link session to conversation if needed
    await linkSessionToConversation(conversationId, session.id);
    
    // Process the message using our advanced message processor
    const processedMessage = processMetaMessage(message, platform);
    
    // Store the incoming message with enhanced content
    const saveUserMessage = async () => {
      const { data, error } = await supabase
        .from('messages')
        .insert([{
          conversation_id: conversationId,
          content: processedMessage.text,
          sender_type: 'user',
          external_id: message.mid || null,
          sent_at: new Date(timestamp).toISOString()
        }])
        .select();
        
      if (error) throw error;
      return data[0];
    };
    
    const savedMessage = await retryWithBackoff(saveUserMessage, {
      maxRetries: 2,
      initialDelay: 300,
      shouldRetry: (error) => isTransientError(error)
    });
    
    // Update session context with user message
    await updateSessionContext(session.id, {
      lastUserMessage: processedMessage.text
    });
    
    // Get the user's Voiceflow mapping to process the message
    const getVoiceflowMapping = async () => {
      const { data, error } = await supabase
        .from('voiceflow_mappings')
        .select('*')
        .eq('user_id', userId)
        .limit(1);
        
      if (error) throw error;
      if (!data || data.length === 0) throw new Error('No Voiceflow agent configured');
      
      return data[0];
    };
    
    const voiceflowMapping = await retryWithBackoff(getVoiceflowMapping, {
      maxRetries: 2,
      initialDelay: 300,
      shouldRetry: (error) => isTransientError(error)
    });
    
    // Get Voiceflow API key if available
    const getApiKey = async () => {
      const { data } = await supabase
        .from('voiceflow_api_keys')
        .select('api_key')
        .eq('user_id', userId)
        .limit(1);
        
      return data && data.length > 0 ? data[0].api_key : process.env.VOICEFLOW_API_KEY;
    };
    
    const apiKey = await retryWithBackoff(getApiKey, {
      maxRetries: 2,
      initialDelay: 300,
      shouldRetry: (error) => isTransientError(error)
    });
    
    if (!apiKey) {
      throw new Error('No Voiceflow API key found');
    }
    
    // Prepare user context for Voiceflow including session data
    const baseContext = {
      messageId: savedMessage.id,
      participantId: senderId,
      platform,
      conversationId,
      timestamp: new Date(timestamp).toISOString()
    };
    
    // Get complete context from session
    const voiceflowContext = await prepareVoiceflowContext(session.id, baseContext);
    
    // Prepare the Voiceflow request with enhanced data and session context
    const voiceflowRequest = prepareVoiceflowRequest(processedMessage, voiceflowContext);
    
    // Process message with Voiceflow with retry
    const callVoiceflow = async () => {
      return await axios.post(
        `https://general-runtime.voiceflow.com/state/user/${userId}/interact`,
        voiceflowRequest,
        {
          headers: {
            Authorization: `Bearer ${apiKey}`,
            'Content-Type': 'application/json'
          },
          timeout: 15000 // 15 second timeout
        }
      );
    };
    
    let voiceflowResponse;
    try {
      voiceflowResponse = await retryWithBackoff(callVoiceflow, {
        maxRetries: 3,
        initialDelay: 1000,
        maxDelay: 5000,
        shouldRetry: (error) => isTransientError(error) || error.response?.status >= 500
      });
      
      // Extract any context updates from the Voiceflow response
      const contextUpdates = extractContextFromVoiceflowResponse(voiceflowResponse.data);
      
      // Update the session context
      if (Object.keys(contextUpdates).length > 0) {
        await updateSessionContext(session.id, contextUpdates);
      }
      
      // Extend the session expiry
      await extendSession(session.id);
      
    } catch (voiceflowError) {
      // If Voiceflow call fails after retries, save to dead letter queue
      await saveToDeadLetterQueue(
        userId, 
        processedMessage.text, 
        voiceflowError.message,
        {
          platform,
          conversationId,
          messageId: savedMessage.id,
          timestamp,
          sessionId: session.id
        }
      );
      
      // Return a graceful error to the user
      throw new Error('Failed to process message with AI assistant after multiple attempts');
    }
    
    // Format the Voiceflow response for Meta platforms
    const formattedResponse = formatVoiceflowResponse(voiceflowResponse.data);
    
    // Store the assistant's response
    const saveAssistantMessage = async () => {
      const { data, error } = await supabase
        .from('messages')
        .insert([{
          conversation_id: conversationId,
          content: formattedResponse.text,
          sender_type: 'assistant',
          sent_at: new Date().toISOString()
        }])
        .select();
        
      if (error) throw error;
      return data[0];
    };
    
    const assistantMessage = await retryWithBackoff(saveAssistantMessage, {
      maxRetries: 2,
      initialDelay: 300
    });
    
    // Update session context with assistant's response
    await updateSessionContext(session.id, {
      lastAssistantMessage: formattedResponse.text
    });
    
    // Send response back to the user via Meta API
    const accessToken = connection.access_token;
    
    const sendResponse = async () => {
      if (platform === 'facebook') {
        // Prepare the response object for Facebook
        const fbResponse = {
          recipient: { id: senderId },
          message: formattedResponse,
          messaging_type: 'RESPONSE'
        };
        
        return await axios.post(
          `https://graph.facebook.com/v18.0/me/messages`,
          fbResponse,
          {
            params: { access_token: accessToken },
            timeout: 10000
          }
        );
      } else if (platform === 'instagram') {
        // Prepare the response object for Instagram
        const igResponse = {
          recipient: { id: senderId },
          message: formattedResponse,
          messaging_type: 'RESPONSE'
        };
        
        return await axios.post(
          `https://graph.facebook.com/v18.0/${connection.ig_account_id}/messages`,
          igResponse,
          {
            params: { access_token: accessToken },
            timeout: 10000
          }
        );
      }
    };
    
    try {
      await retryWithBackoff(sendResponse, {
        maxRetries: 3,
        initialDelay: 1000,
        shouldRetry: (error) => isTransientError(error)
      });
    } catch (sendError) {
      console.error('Failed to send response after retries:', sendError);
      // We've already saved the message to the database, so we'll return a partial success
      return { 
        success: true, 
        warning: 'Message processed but failed to deliver to user',
        messageId: assistantMessage.id,
        sessionId: session.id
      };
    }
    
    return { 
      success: true, 
      messageId: assistantMessage.id,
      sessionId: session.id
    };
    
  } catch (error) {
    const errorDetails = processError(error, {
      userId,
      platform,
      senderId,
      recipientId
    });
    
    console.error('Failed to process message:', errorDetails);
    
    // If this is a transient error, we might want to retry
    if (errorDetails.isTransient) {
      return { 
        success: false, 
        error: error.message,
        transient: true,
        shouldRetry: true
      };
    }
    
    return { success: false, error: error.message };
  }
}

/**
 * Extract context variables from Voiceflow response
 * 
 * @param {Array} voiceflowResponse Response from Voiceflow API
 * @returns {Object} Context variables to store in session
 */
function extractContextFromVoiceflowResponse(voiceflowResponse) {
  if (!Array.isArray(voiceflowResponse)) {
    return {};
  }
  
  const contextUpdates = {};
  
  voiceflowResponse.forEach(item => {
    // Look for updated variables in the Voiceflow response
    if (item.type === 'set-variables' && item.payload) {
      Object.entries(item.payload).forEach(([key, value]) => {
        contextUpdates[key] = value;
      });
    }
    
    // Look for specific context markers in messages
    if (item.type === 'text' && item.payload?.message) {
      // Check for special context markers like [[SET:key=value]]
      const contextMarkerRegex = /\[\[SET:([a-zA-Z0-9_]+)=([^\]]+)\]\]/g;
      const message = item.payload.message;
      
      let match;
      while ((match = contextMarkerRegex.exec(message)) !== null) {
        const [fullMatch, key, value] = match;
        contextUpdates[key] = value;
      }
    }
  });
  
  return contextUpdates;
}

exports.handler = async (event, context) => {
  // Set CORS headers for all responses
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type, X-Hub-Signature, X-Hub-Signature-256',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS'
  };
  
  // Handle preflight requests
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 204,
      headers
    };
  }
  
  // Handle GET requests (webhook verification) by forwarding to the verification function
  if (event.httpMethod === 'GET') {
    // Import the verification function
    const verificationHandler = require('./meta-webhook-verification');
    return verificationHandler.handler(event, context);
  }
  
  // Only process POST requests for actual webhook events
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      headers,
      body: JSON.stringify({ error: 'Method not allowed. Please use POST for webhook events.' })
    };
  }
  
  // Enhanced webhook security validation
  const body = event.body;
  const appSecret = process.env.META_APP_SECRET;
  
  if (appSecret) {
    const validationResult = validateWebhook(event.headers, body, appSecret);
    
    if (!validationResult.valid) {
      console.error('Invalid webhook signature:', validationResult.message);
      
      // Log detailed information about the failed validation
      console.error('Webhook validation failed:', {
        headers: Object.keys(event.headers),
        bodyLength: body ? body.length : 0,
        path: event.path,
        method: event.httpMethod
      });
      
      return {
        statusCode: 401,
        headers,
        body: JSON.stringify({ 
          error: 'Invalid webhook signature', 
          details: validationResult.message 
        })
      };
    }
    
    console.log('Webhook signature verified using:', validationResult.method);
  } else {
    console.warn('No META_APP_SECRET environment variable set. Skipping signature validation!');
  }
  
  // Path parameters can help identify which user and platform this is for
  const path = event.path;
  const pathSegments = path.split('/');
  
  // Expected format: /api/webhooks/{userId}/{platform}/{timestamp}
  let userId = null;
  let platform = null;
  
  if (pathSegments.length >= 5 && pathSegments[2] === 'webhooks') {
    userId = pathSegments[3];
    platform = pathSegments[4];
  }
  
  if (!userId || !platform) {
    console.error('Missing userId or platform in webhook URL:', path);
    return {
      statusCode: 400,
      headers,
      body: JSON.stringify({ error: 'Invalid webhook URL format. Expected /api/webhooks/{userId}/{platform}/{timestamp}' })
    };
  }
  
  // Verify platform is valid
  if (platform !== 'facebook' && platform !== 'instagram') {
    return {
      statusCode: 400,
      headers,
      body: JSON.stringify({ error: 'Invalid platform. Expected "facebook" or "instagram".' })
    };
  }
  
  try {
    // Parse the webhook payload
    let data;
    try {
      data = JSON.parse(body);
    } catch (e) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'Invalid request body. JSON parsing failed.' })
      };
    }
    
    // Skip if this is not a messaging webhook
    if (!data.object || (data.object !== 'page' && data.object !== 'instagram')) {
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({ status: 'ignored', message: 'Not a messaging webhook event' })
      };
    }
    
    console.log('Received webhook event:', JSON.stringify(data, null, 2));
    
    // Process each entry and messaging event by first adding them to the queue
    const queueResults = [];
    
    for (const entry of data.entry) {
      // Handle both Facebook and Instagram formats
      const messagingEvents = entry.messaging || entry.changes;
      
      if (!messagingEvents) continue;
      
      for (const event of messagingEvents) {
        // For Instagram, the structure is different
        if (platform === 'instagram' && event.field === 'messages') {
          const value = event.value;
          
          // Process Instagram message format
          const { senderId, recipientId, message, timestamp } = processInstagramMessage(value);
          
          // Add message to the queue for processing
          const queueResult = await queueMessage(
            userId,
            platform,
            senderId,
            recipientId,
            message,
            timestamp
          );
          
          queueResults.push({
            success: true,
            queueId: queueResult.id,
            platform: 'instagram'
          });
        } 
        // For Facebook messages
        else if (platform === 'facebook' && event.message && !event.message.is_echo) {
          const senderId = event.sender.id;
          const recipientId = event.recipient.id;
          const timestamp = event.timestamp;
          
          // Add message to the queue for processing
          const queueResult = await queueMessage(
            userId,
            platform,
            senderId,
            recipientId,
            event.message,
            timestamp
          );
          
          queueResults.push({
            success: true,
            queueId: queueResult.id,
            platform: 'facebook',
            type: 'message'
          });
        }
        // For Facebook postbacks (button clicks)
        else if (platform === 'facebook' && event.postback) {
          const senderId = event.sender.id;
          const recipientId = event.recipient.id;
          const timestamp = event.timestamp;
          
          // Treat postback as a message for processing
          const postbackMessage = {
            mid: `postback-${Date.now()}`,
            postback: event.postback
          };
          
          // Add postback to the queue for processing
          const queueResult = await queueMessage(
            userId,
            platform,
            senderId,
            recipientId,
            postbackMessage,
            timestamp
          );
          
          queueResults.push({
            success: true,
            queueId: queueResult.id,
            platform: 'facebook',
            type: 'postback'
          });
        }
      }
    }
    
    // Process a few messages right away to provide immediate response
    const processingResults = await processPendingMessages(processMessage, 2);
    
    // Return success to acknowledge receipt of the webhooks
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ 
        status: 'success',
        message: 'Webhook events received and queued for processing',
        queued: queueResults.length,
        processed: processingResults.processed
      })
    };
    
  } catch (error) {
    console.error('Error handling webhook event:', error);
    
    // Always return a 200 status to Meta to avoid them retrying
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ 
        status: 'error',
        message: 'Error processing webhook',
        error: error.message
      })
    };
  }
};

// Export the processMessage function for use by process-message-queue.js
module.exports = {
  processMessage
};