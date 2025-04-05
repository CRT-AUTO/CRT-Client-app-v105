// This module handles user session management and context persistence

const { createClient } = require('@supabase/supabase-js');
const { retryWithBackoff, isTransientError } = require('./error-recovery');

// Initialize Supabase client with error handling
let supabase = null;
try {
  const supabaseUrl = process.env.VITE_SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY;
  
  if (supabaseUrl && supabaseServiceKey) {
    supabase = createClient(supabaseUrl, supabaseServiceKey);
    console.log("Supabase client initialized successfully in session manager");
  } else {
    console.warn(`Missing Supabase credentials in session-manager.js. URL: ${supabaseUrl ? 'Present' : 'Missing'}, Service Key: ${supabaseServiceKey ? 'Present' : 'Missing'}`);
  }
} catch (error) {
  console.error('Error initializing Supabase client in session-manager.js:', error);
}

// Session expiry time in hours - very long duration for persistent sessions
const SESSION_EXPIRY_HOURS = 8760; // 365 days

/**
 * Get or create a session for a user and participant
 * 
 * @param {string} userId User ID
 * @param {string} participantId External participant ID
 * @param {string} platform 'facebook' or 'instagram'
 * @returns {Promise<Object>} The session object
 */
async function getOrCreateSession(userId, participantId, platform) {
  try {
    if (!supabase) {
      throw new Error('Database connection not available');
    }
    
    // CHANGE: Don't filter by expiry date - always get the latest session
    // for this user/participant, regardless of expiry
    const { data: existingSessions, error } = await supabase
      .from('user_sessions')
      .select('*')
      .eq('user_id', userId)
      .eq('participant_id', participantId)
      .eq('platform', platform)
      .order('last_interaction', { ascending: false })
      .limit(1);
      
    if (error) throw error;
    
    // If a session exists, extend it and return it
    if (existingSessions && existingSessions.length > 0) {
      // Extend the session expiry
      await extendSession(existingSessions[0].id, SESSION_EXPIRY_HOURS);
      return existingSessions[0];
    }
    
    // Otherwise, create a new long-lived session
    const expiryDate = new Date();
    expiryDate.setHours(expiryDate.getHours() + SESSION_EXPIRY_HOURS);
    
    const { data: newSession, error: createError } = await supabase
      .from('user_sessions')
      .insert([{
        user_id: userId,
        participant_id: participantId,
        platform,
        context: {
          conversationHistory: [] // Initialize empty conversation history
        },
        expires_at: expiryDate.toISOString()
      }])
      .select();
      
    if (createError) throw createError;
    
    return newSession[0];
  } catch (error) {
    console.error('Error getting or creating session:', error);
    throw error;
  }
}

/**
 * Update a session's context
 * 
 * @param {string} sessionId Session ID
 * @param {Object} contextUpdates New context data to merge with existing context
 * @returns {Promise<Object>} Updated session
 */
async function updateSessionContext(sessionId, contextUpdates) {
  try {
    if (!supabase) {
      throw new Error('Database connection not available');
    }
    
    // First get the current context
    const { data: session, error } = await supabase
      .from('user_sessions')
      .select('context')
      .eq('id', sessionId)
      .single();
      
    if (error) throw error;
    
    // ENHANCEMENT: Add conversation history to context
    const currentContext = session.context || {};
    
    // Initialize conversation history if it doesn't exist
    if (!currentContext.conversationHistory) {
      currentContext.conversationHistory = [];
    }
    
    // If there's a new message in the context updates, add it to history
    if (contextUpdates.lastUserMessage) {
      currentContext.conversationHistory.push({
        role: 'user',
        content: contextUpdates.lastUserMessage,
        timestamp: new Date().toISOString()
      });
    }
    
    if (contextUpdates.lastAssistantMessage) {
      currentContext.conversationHistory.push({
        role: 'assistant',
        content: contextUpdates.lastAssistantMessage,
        timestamp: new Date().toISOString()
      });
    }
    
    // Limit history size if needed (e.g., keep last 50 messages)
    if (currentContext.conversationHistory.length > 50) {
      currentContext.conversationHistory = currentContext.conversationHistory.slice(-50);
    }
    
    // Merge the existing context with updates
    const updatedContext = {
      ...currentContext,
      ...contextUpdates,
      lastUpdated: new Date().toISOString()
    };
    
    // Update the session
    const { data: updatedSession, error: updateError } = await supabase
      .from('user_sessions')
      .update({
        context: updatedContext,
        last_interaction: new Date().toISOString()
      })
      .eq('id', sessionId)
      .select();
      
    if (updateError) throw updateError;
    
    return updatedSession[0];
  } catch (error) {
    console.error('Error updating session context:', error);
    throw error;
  }
}

/**
 * Get a session by ID
 * 
 * @param {string} sessionId Session ID
 * @returns {Promise<Object>} The session object
 */
async function getSession(sessionId) {
  try {
    if (!supabase) {
      throw new Error('Database connection not available');
    }
    
    const { data, error } = await supabase
      .from('user_sessions')
      .select('*')
      .eq('id', sessionId)
      .single();
      
    if (error) throw error;
    return data;
  } catch (error) {
    console.error('Error getting session:', error);
    throw error;
  }
}

/**
 * Associate a session with a conversation
 * 
 * @param {string} conversationId Conversation ID
 * @param {string} sessionId Session ID
 * @returns {Promise<boolean>} Success status
 */
async function linkSessionToConversation(conversationId, sessionId) {
  try {
    if (!supabase) {
      throw new Error('Database connection not available');
    }
    
    const { error } = await supabase
      .from('conversations')
      .update({ session_id: sessionId })
      .eq('id', conversationId);
      
    if (error) throw error;
    return true;
  } catch (error) {
    console.error('Error linking session to conversation:', error);
    throw error;
  }
}

/**
 * Extend a session's expiration time
 * 
 * @param {string} sessionId Session ID
 * @param {number} hours Number of hours to extend
 * @returns {Promise<Object>} Updated session
 */
async function extendSession(sessionId, hours = SESSION_EXPIRY_HOURS) {
  try {
    if (!supabase) {
      throw new Error('Database connection not available');
    }
    
    const expiryDate = new Date();
    expiryDate.setHours(expiryDate.getHours() + hours);
    
    const { data, error } = await supabase
      .from('user_sessions')
      .update({
        expires_at: expiryDate.toISOString(),
        last_interaction: new Date().toISOString()
      })
      .eq('id', sessionId)
      .select();
      
    if (error) throw error;
    return data[0];
  } catch (error) {
    console.error('Error extending session:', error);
    throw error;
  }
}

/**
 * Clean up expired sessions
 * 
 * @returns {Promise<number>} Number of sessions cleaned up
 */
async function cleanupExpiredSessions() {
  try {
    if (!supabase) {
      throw new Error('Database connection not available');
    }
    
    const now = new Date().toISOString();
    
    const { data, error } = await supabase
      .from('user_sessions')
      .delete()
      .lt('expires_at', now)
      .select();
      
    if (error) throw error;
    
    console.log(`Cleaned up ${data.length} expired sessions`);
    return data.length;
  } catch (error) {
    console.error('Error cleaning up expired sessions:', error);
    throw error;
  }
}

/**
 * Prepare contextual data for Voiceflow from session
 * 
 * @param {string} sessionId Session ID
 * @param {Object} additionalContext Additional context to include
 * @returns {Promise<Object>} Context object for Voiceflow
 */
async function prepareVoiceflowContext(sessionId, additionalContext = {}) {
  try {
    if (!supabase) {
      return {
        ...additionalContext,
        error: 'Database connection not available'
      };
    }
    
    // Get the session
    const session = await getSession(sessionId);
    
    // Extract the session context
    const sessionContext = session.context || {};
    
    // ENHANCEMENT: Prepare conversation summary for Voiceflow
    let conversationSummary = '';
    
    if (sessionContext.conversationHistory && sessionContext.conversationHistory.length > 0) {
      // Take the last 10 messages to provide immediate context
      const recentMessages = sessionContext.conversationHistory.slice(-10);
      
      // Format them into a summary
      conversationSummary = recentMessages.map(msg => 
        `${msg.role === 'user' ? 'User' : 'Assistant'}: ${msg.content}`
      ).join('\n');
    }
    
    // Combine session context with additional context
    const combinedContext = {
      ...sessionContext,
      ...additionalContext,
      sessionId: session.id,
      participantId: session.participant_id,
      platform: session.platform,
      sessionCreatedAt: session.created_at,
      lastInteraction: session.last_interaction,
      conversationSummary: conversationSummary
    };
    
    return combinedContext;
  } catch (error) {
    console.error('Error preparing Voiceflow context:', error);
    // Return default context on error
    return {
      ...additionalContext,
      error: 'Failed to load session context'
    };
  }
}

module.exports = {
  getOrCreateSession,
  updateSessionContext,
  getSession,
  linkSessionToConversation,
  extendSession,
  cleanupExpiredSessions,
  prepareVoiceflowContext
};