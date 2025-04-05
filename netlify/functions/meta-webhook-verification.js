// This is a Netlify serverless function that handles Meta's webhook verification process
// When setting up webhooks, Meta will send a GET request to verify ownership

const { createClient } = require('@supabase/supabase-js');

// Initialize Supabase client for verification if needed
let supabase = null;
try {
  const supabaseUrl = process.env.VITE_SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY;
  if (supabaseUrl && supabaseServiceKey) {
    supabase = createClient(supabaseUrl, supabaseServiceKey);
    console.log("Supabase client initialized successfully in verification");
  } else {
    console.warn(`Missing Supabase credentials. URL: ${supabaseUrl ? 'Present' : 'Missing'}, Service Key: ${supabaseServiceKey ? 'Present' : 'Missing'}`);
  }
} catch (error) {
  console.error('Error initializing Supabase client:', error);
}

exports.handler = async (event, context) => {
  // Set CORS headers for all responses
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'GET, OPTIONS'
  };

  // Handle preflight requests
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers };
  }

  // Only accept GET requests for webhook verification
  if (event.httpMethod !== 'GET') {
    return {
      statusCode: 405,
      headers,
      body: JSON.stringify({ error: 'Method not allowed. Please use GET for webhook verification.' })
    };
  }

  try {
    // Extract verification parameters sent by Meta
    const params = event.queryStringParameters || {};
    const mode = params['hub.mode'];
    const token = params['hub.verify_token'];
    const challenge = params['hub.challenge'];

    console.log('Webhook verification request received:', {
      path: event.path,
      mode,
      token: token ? '[REDACTED]' : 'undefined',
      challenge: challenge || 'undefined',
      queryParams: JSON.stringify(params)
    });

    // CRITICAL: Verify all required parameters are present
    if (!mode || !token || !challenge) {
      console.log('Missing required parameters:', { mode, token: !!token, challenge });
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'Missing required parameters' })
      };
    }

    // Verification mode must be 'subscribe'
    if (mode !== 'subscribe') {
      console.log('Invalid hub.mode parameter:', mode);
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'Invalid hub.mode parameter. Expected "subscribe".' })
      };
    }

    // Extract userId and platform from path if available
    const pathSegments = event.path.split('/');
    let userId = null;
    let platform = 'all';
    if (pathSegments.length >= 5 && pathSegments[2] === 'webhooks') {
      userId = pathSegments[3];
      platform = pathSegments[4];
      console.log(`Extracted userId: ${userId}, platform: ${platform}`);
    }

    // CRITICAL: First check against known tokens
    const knownTokens = [
      '14abae006d729dbc83ca136af12bbbe1d9480eff' // Your verification token
    ];

    if (knownTokens.includes(token)) {
      console.log('Verification successful using known token');
      // CRITICAL: Return ONLY the challenge value in plain text
      return {
        statusCode: 200,
        headers: {
          'Content-Type': 'text/plain'
        },
        body: challenge
      };
    }

    // If we have a database connection, verify against stored tokens
    if (supabase) {
      console.log('Checking token against database...');
      let query = supabase.from('webhook_configs').select('*').eq('verification_token', token);
      
      if (userId) {
        query = query.eq('user_id', userId);
        console.log(`Filtering by user_id: ${userId}`);
      }
      if (platform && platform !== 'all') {
        query = query.eq('platform', platform);
        console.log(`Filtering by platform: ${platform}`);
      }

      const { data: webhookConfigs, error } = await query;

      if (error) {
        console.error('Error querying webhook configurations:', error);
        return {
          statusCode: 500,
          headers,
          body: JSON.stringify({ error: 'Error verifying webhook token.' })
        };
      }

      if (webhookConfigs && webhookConfigs.length > 0) {
        console.log(`Verification successful for webhook configuration ID: ${webhookConfigs[0].id}`);
        
        // Update the webhook config to mark it as verified
        try {
          await supabase
            .from('webhook_configs')
            .update({ 
              meta_verification_status: 'verified',
              updated_at: new Date().toISOString()
            })
            .eq('id', webhookConfigs[0].id);
        } catch (updateError) {
          console.error('Error updating webhook verification status:', updateError);
          // Continue even if update fails
        }
        
        // CRITICAL: Return ONLY the challenge value in plain text
        return {
          statusCode: 200,
          headers: {
            'Content-Type': 'text/plain'
          },
          body: challenge
        };
      }
    }

    // No matching token found
    console.log('No matching verification token found');
    return {
      statusCode: 401,
      headers,
      body: JSON.stringify({ error: 'Invalid verification token.' })
    };

  } catch (error) {
    console.error('Error in webhook verification:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: 'Internal server error during webhook verification.' })
    };
  }
};