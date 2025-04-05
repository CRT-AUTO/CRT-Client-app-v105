// This module provides error recovery and retry mechanisms with exponential backoff

/**
 * Retry a function with exponential backoff
 * 
 * @param {Function} fn Function to retry
 * @param {Object} options Options for retry behavior
 * @param {number} options.maxRetries Maximum number of retries
 * @param {number} options.initialDelay Initial delay in ms
 * @param {number} options.maxDelay Maximum delay in ms
 * @param {Function} options.shouldRetry Function that decides if retry should happen
 * @param {Function} options.onRetry Callback executed before each retry
 * @returns {Promise<any>} Result of the function call
 */
async function retryWithBackoff(fn, options = {}) {
  const {
    maxRetries = 3,
    initialDelay = 500,
    maxDelay = 10000,
    backoffFactor = 2,
    shouldRetry = () => true,
    onRetry = null
  } = options;
  
  let lastError;
  
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      // If not first attempt, apply delay
      if (attempt > 0) {
        // Calculate backoff delay with jitter
        const delay = Math.min(
          maxDelay,
          initialDelay * Math.pow(backoffFactor, attempt - 1) * (0.8 + Math.random() * 0.4)
        );
        
        console.log(`Retry attempt ${attempt}/${maxRetries} after ${delay}ms delay`);
        
        // Wait for the backoff period
        await new Promise(resolve => setTimeout(resolve, delay));
        
        // Call onRetry callback if provided
        if (onRetry) {
          await onRetry(attempt, lastError);
        }
      }
      
      // Attempt to call the function
      return await fn();
    } catch (error) {
      lastError = error;
      
      // Log the error
      console.error(`Attempt ${attempt + 1}/${maxRetries + 1} failed:`, error);
      
      // Check if we should retry
      if (attempt >= maxRetries || !shouldRetry(error, attempt)) {
        console.error(`Max retries reached or should not retry. Giving up.`);
        break;
      }
    }
  }
  
  // If we got here, all retries failed
  throw lastError;
}

/**
 * Determine if an error is transient and should be retried
 * 
 * @param {Error} error The error to analyze
 * @returns {boolean} True if the error is likely transient
 */
function isTransientError(error) {
  // Network errors
  if (error.message?.includes('ECONNRESET') || 
      error.message?.includes('ETIMEDOUT') ||
      error.message?.includes('ENOTFOUND') ||
      error.message?.includes('network') ||
      error.code === 'ECONNABORTED') {
    return true;
  }
  
  // Rate limiting or server overload
  if (error.response?.status === 429 || 
      error.response?.status === 503 ||
      error.response?.status === 504) {
    return true;
  }
  
  // Temporary API errors
  if (error.response?.status >= 500 && error.response?.status < 600) {
    return true;
  }
  
  // Database connection errors
  if (error.message?.includes('Database connection') ||
      error.message?.includes('not available')) {
    return true;
  }
  
  return false;
}

/**
 * Save a failed message to dead letter storage for later processing
 * 
 * @param {string} userId User ID
 * @param {Object} message Message that failed to process
 * @param {string} errorMessage Error message
 * @param {Object} metadata Additional metadata about the failure
 * @returns {Promise<Object>} Result of the dead letter save operation
 */
async function saveToDeadLetterQueue(userId, message, errorMessage, metadata = {}) {
  try {
    const { createClient } = require('@supabase/supabase-js');
    
    // Initialize Supabase with error handling
    const supabaseUrl = process.env.VITE_SUPABASE_URL;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY;
    
    if (!supabaseUrl || !supabaseServiceKey) {
      console.error('Missing Supabase credentials for dead letter queue');
      return { success: false, error: 'Missing database credentials' };
    }
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    
    // Save to dead letter table (which would need to be created)
    const { data, error } = await supabase
      .from('message_dead_letters')
      .insert([{
        user_id: userId,
        message_content: typeof message === 'string' ? message : JSON.stringify(message),
        error_message: errorMessage,
        metadata: metadata,
        failed_at: new Date().toISOString(),
        retry_count: 0,
        status: 'failed'
      }])
      .select();
      
    if (error) {
      console.error('Error saving to dead letter queue:', error);
      return { success: false, error };
    }
    
    return { success: true, deadLetterId: data[0].id };
  } catch (saveError) {
    console.error('Error in saveToDeadLetterQueue:', saveError);
    return { success: false, error: saveError };
  }
}

/**
 * Process errors in a standardized way
 * 
 * @param {Error} error Error to process
 * @param {Object} context Context about where the error occurred
 * @returns {Object} Standardized error response
 */
function processError(error, context = {}) {
  // Extract useful information from the error
  const errorInfo = {
    message: error.message,
    code: error.code,
    status: error.response?.status,
    data: error.response?.data,
    stack: error.stack,
    isTransient: isTransientError(error),
    context,
    timestamp: new Date().toISOString()
  };
  
  // Log detailed error information
  console.error('Processed error:', JSON.stringify(errorInfo, null, 2));
  
  // Return a standardized error object
  return {
    error: true,
    message: error.message,
    isTransient: errorInfo.isTransient,
    code: error.code || error.response?.status || 'UNKNOWN_ERROR',
    timestamp: errorInfo.timestamp
  };
}

module.exports = {
  retryWithBackoff,
  isTransientError,
  saveToDeadLetterQueue,
  processError
};