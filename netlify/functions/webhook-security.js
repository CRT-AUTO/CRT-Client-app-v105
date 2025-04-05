// This module provides security utilities for Meta webhooks

const crypto = require('crypto');

/**
 * Verify webhook payload signature from Meta using SHA1
 * 
 * @param {string} signature X-Hub-Signature header value
 * @param {string} body Raw request body
 * @param {string} appSecret Meta app secret
 * @returns {boolean} Whether the signature is valid
 */
function verifySignatureSHA1(signature, body, appSecret) {
  if (!signature || !body || !appSecret) {
    return false;
  }
  
  try {
    // Extract the signature from the header
    const signatureParts = signature.split('=');
    
    if (signatureParts.length !== 2 || signatureParts[0] !== 'sha1') {
      return false;
    }
    
    const providedSignature = signatureParts[1];
    
    // Calculate expected signature
    const hmac = crypto.createHmac('sha1', appSecret);
    hmac.update(body, 'utf-8');
    const expectedSignature = hmac.digest('hex');
    
    // Compare signatures using a timing-safe comparison
    return crypto.timingSafeEqual(
      Buffer.from(providedSignature),
      Buffer.from(expectedSignature)
    );
  } catch (error) {
    console.error('Error verifying SHA1 signature:', error);
    return false;
  }
}

/**
 * Verify webhook payload signature from Meta using SHA256
 * 
 * @param {string} signature X-Hub-Signature-256 header value
 * @param {string} body Raw request body
 * @param {string} appSecret Meta app secret
 * @returns {boolean} Whether the signature is valid
 */
function verifySignatureSHA256(signature, body, appSecret) {
  if (!signature || !body || !appSecret) {
    return false;
  }
  
  try {
    // Extract the signature from the header
    const signatureParts = signature.split('=');
    
    if (signatureParts.length !== 2 || signatureParts[0] !== 'sha256') {
      return false;
    }
    
    const providedSignature = signatureParts[1];
    
    // Calculate expected signature
    const hmac = crypto.createHmac('sha256', appSecret);
    hmac.update(body, 'utf-8');
    const expectedSignature = hmac.digest('hex');
    
    // Compare signatures using a timing-safe comparison
    return crypto.timingSafeEqual(
      Buffer.from(providedSignature),
      Buffer.from(expectedSignature)
    );
  } catch (error) {
    console.error('Error verifying SHA256 signature:', error);
    return false;
  }
}

/**
 * Comprehensive webhook validation
 * 
 * @param {Object} headers Request headers
 * @param {string} body Raw request body
 * @param {string} appSecret Meta app secret
 * @returns {Object} Validation result
 */
function validateWebhook(headers, body, appSecret) {
  if (!headers || !body || !appSecret) {
    return { 
      valid: false, 
      message: 'Missing required validation parameters'
    };
  }
  
  // Get signatures from headers
  const sha1Signature = headers['x-hub-signature'] || headers['X-Hub-Signature'];
  const sha256Signature = headers['x-hub-signature-256'] || headers['X-Hub-Signature-256'];
  
  // Check for presence of at least one signature
  if (!sha1Signature && !sha256Signature) {
    return { 
      valid: false, 
      message: 'No signature headers found'
    };
  }
  
  // Validate signatures (prefer SHA-256 if available)
  let isValid = false;
  let method = '';
  
  if (sha256Signature) {
    isValid = verifySignatureSHA256(sha256Signature, body, appSecret);
    method = 'SHA-256';
  }
  
  // If SHA-256 validation failed or wasn't available, try SHA-1
  if (!isValid && sha1Signature) {
    isValid = verifySignatureSHA1(sha1Signature, body, appSecret);
    method = 'SHA-1';
  }
  
  // Return validation result
  if (isValid) {
    return { 
      valid: true, 
      method,
      message: `Successfully validated webhook signature using ${method}`
    };
  } else {
    return { 
      valid: false, 
      method: method || 'None',
      message: `Invalid webhook signature${method ? ` (${method})` : ''}`
    };
  }
}

module.exports = {
  verifySignatureSHA1,
  verifySignatureSHA256,
  validateWebhook
};