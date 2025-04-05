// This is a Netlify serverless function that processes the message queue
// It's intended to be called periodically to process any pending messages

const { processPendingMessages } = require('./message-queue');
const { processMessage } = require('./meta-webhook-handler');

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
    console.log('Starting message queue processing');
    
    // Determine batch size from query parameters or default to 5
    const batchSize = event.queryStringParameters?.batchSize 
      ? parseInt(event.queryStringParameters.batchSize, 10) 
      : 5;
      
    // Process pending messages
    const result = await processPendingMessages(processMessage, batchSize);
    
    console.log(`Processed ${result.processed} messages from the queue`);
    
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ 
        status: 'success',
        processed: result.processed,
        results: result.results
      })
    };
  } catch (error) {
    console.error('Error processing message queue:', error);
    
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ 
        status: 'error',
        message: 'Error processing message queue',
        error: error.message
      })
    };
  }
};