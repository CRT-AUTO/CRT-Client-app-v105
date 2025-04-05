// This is a Netlify serverless function to clean up expired sessions
// It should be called periodically (e.g., once a day)

const { cleanupExpiredSessions } = require('./session-manager');

exports.handler = async (event, context) => {
  // Set CORS headers for all responses
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS'
  };
  
  // Handle preflight requests
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 204,
      headers
    };
  }
  
  try {
    console.log('Starting session cleanup');
    
    // Clean up expired sessions
    const cleanedCount = await cleanupExpiredSessions();
    
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ 
        status: 'success',
        message: `Cleaned up ${cleanedCount} expired sessions`
      })
    };
  } catch (error) {
    console.error('Error cleaning up sessions:', error);
    
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ 
        status: 'error',
        message: 'Error cleaning up sessions',
        error: error.message
      })
    };
  }
};