// This is a Netlify serverless function that handles Facebook's data deletion requests
// Documentation: https://developers.facebook.com/docs/apps/delete-data/

// Helper function to decode base64 URL-encoded string
function base64UrlDecode(input) {
  // Replace URL-safe characters
  input = input.replace(/-/g, '+').replace(/_/g, '/');
  
  // Add padding if needed
  const pad = input.length % 4;
  if (pad) {
    if (pad === 1) {
      throw new Error('Invalid base64 string');
    }
    input += new Array(5 - pad).join('=');
  }
  
  // Decode base64
  return Buffer.from(input, 'base64').toString('utf8');
}

// Parse and verify the signed request from Facebook
function parseSignedRequest(signedRequest, secret) {
  // Split the signed request into signature and payload
  const [encodedSignature, encodedPayload] = signedRequest.split('.');
  
  // Decode the payload
  const payload = JSON.parse(base64UrlDecode(encodedPayload));
  
  // In a production environment, you would verify the signature here
  // using the secret from your Facebook app
  
  return payload;
}

// Main function handler
exports.handler = async (event, context) => {
  // Set CORS headers to ensure the endpoint is accessible
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Content-Type': 'application/json'
  };
  
  // Handle OPTIONS request (preflight CORS check)
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 204,  // No content
      headers
    };
  }
  
  // Only accept POST requests
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      headers,
      body: JSON.stringify({ error: 'Method not allowed' })
    };
  }
  
  try {
    // Parse the request body
    let params;
    if (event.body) {
      if (event.isBase64Encoded) {
        const buff = Buffer.from(event.body, 'base64');
        params = new URLSearchParams(buff.toString());
      } else {
        params = new URLSearchParams(event.body);
      }
    } else {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'Missing request body' })
      };
    }
    
    // Get the signed_request parameter
    const signedRequest = params.get('signed_request');
    
    // Log the request for debugging
    console.log('Received data deletion request. Body:', event.body);
    
    if (!signedRequest) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'Missing signed_request parameter' })
      };
    }
    
    // Get the app secret from environment variables
    // This should be configured in Netlify dashboard
    const appSecret = process.env.META_APP_SECRET;
    
    if (!appSecret) {
      console.error('Missing META_APP_SECRET environment variable');
      return {
        statusCode: 500,
        headers,
        body: JSON.stringify({ error: 'Server configuration error' })
      };
    }
    
    // Parse the signed request
    const data = parseSignedRequest(signedRequest, appSecret);
    
    // Extract the user ID
    const userId = data.user_id;
    
    if (!userId) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'Invalid user data in the request' })
      };
    }
    
    // Generate a unique confirmation code
    const confirmationCode = 'DEL' + Math.random().toString(36).substring(2, 10).toUpperCase();
    
    // This is where you would initiate your data deletion process
    // For example, calling your database to delete the user's data
    console.log(`Received data deletion request for user ID: ${userId}`);
    console.log(`Confirmation code: ${confirmationCode}`);
    
    // In a real implementation, you would:
    // 1. Store this deletion request in your database
    // 2. Schedule or immediately execute the actual data deletion
    // 3. Provide a way for the user to check the status
    
    // For this example, we'll simulate initiating the deletion process
    await initiateDataDeletion(userId, confirmationCode);
    
    // Return the required JSON response with URL and confirmation code
    // This URL should allow the user to check the status of their deletion request
    const baseUrl = process.env.URL || 'https://fantastic-gingersnap-f39ca5.netlify.app';
    const statusUrl = `${baseUrl}/deletion-status?code=${confirmationCode}`;
    
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        url: statusUrl,
        confirmation_code: confirmationCode
      })
    };
    
  } catch (error) {
    console.error('Error processing data deletion request:', error);
    
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: 'Internal server error' })
    };
  }
};

// Simulated function to initiate data deletion
async function initiateDataDeletion(userId, confirmationCode) {
  // In a real implementation, this would:
  // 1. Connect to your database
  // 2. Delete or anonymize the user's data
  // 3. Update the status of the deletion request
  
  // For this example, we'll just log the action
  console.log(`Initiating data deletion for user ${userId} with confirmation code ${confirmationCode}`);
  
  // You would typically use your database client to delete the data
  // For example, with Supabase:
  /*
  const { data, error } = await supabase
    .from('user_data')
    .delete()
    .match({ facebook_user_id: userId });
  
  if (error) throw error;
  */
  
  return true;
}