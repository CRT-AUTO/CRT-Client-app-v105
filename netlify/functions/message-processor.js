// This module handles processing of different message types from Meta platforms
// and prepares them for sending to Voiceflow

/**
 * Process a message from Meta and convert it to a format suitable for Voiceflow
 * 
 * @param {Object} message The message object from Meta webhook
 * @param {string} platform 'facebook' or 'instagram'
 * @returns {Object} Processed message content and metadata
 */
function processMetaMessage(message, platform) {
  let processedContent = {
    text: '',
    attachments: [],
    quickReplies: [],
    type: 'text',
    metadata: {}
  };
  
  // Process text messages
  if (message.text) {
    processedContent.text = message.text;
    processedContent.type = 'text';
  }
  
  // Process attachments
  if (message.attachments && message.attachments.length > 0) {
    message.attachments.forEach(attachment => {
      const processedAttachment = processAttachment(attachment);
      processedContent.attachments.push(processedAttachment);
      
      // If no text content yet, use the first attachment's description as text
      if (!processedContent.text && processedAttachment.description) {
        processedContent.text = processedAttachment.description;
      }
      
      // Set the message type based on the first attachment
      if (processedContent.type === 'text') {
        processedContent.type = processedAttachment.type;
      }
    });
  }
  
  // Process quick replies
  if (message.quick_reply) {
    processedContent.quickReplies.push({
      title: 'Quick Reply',
      payload: message.quick_reply.payload
    });
    processedContent.text = message.quick_reply.payload;
    processedContent.type = 'quick_reply';
  }
  
  // Handle postbacks (for Facebook)
  if (message.postback) {
    processedContent.text = message.postback.payload || message.postback.title;
    processedContent.type = 'postback';
    processedContent.metadata.postbackTitle = message.postback.title;
  }
  
  // If still no text, provide a platform-specific default
  if (!processedContent.text) {
    processedContent.text = `[Unsupported ${platform} message type]`;
  }
  
  // Add platform info
  processedContent.metadata.platform = platform;
  processedContent.metadata.messageId = message.mid || null;
  
  return processedContent;
}

/**
 * Process an attachment from Meta
 * 
 * @param {Object} attachment The attachment object from Meta
 * @returns {Object} Processed attachment
 */
function processAttachment(attachment) {
  let processed = {
    type: attachment.type,
    url: null,
    description: null
  };
  
  switch (attachment.type) {
    case 'image':
      processed.url = attachment.payload.url;
      processed.description = `[Image: ${attachment.payload.url}]`;
      break;
      
    case 'audio':
      processed.url = attachment.payload.url;
      processed.description = `[Audio message]`;
      break;
      
    case 'video':
      processed.url = attachment.payload.url;
      processed.description = `[Video message]`;
      break;
      
    case 'file':
      processed.url = attachment.payload.url;
      processed.description = `[File attachment: ${attachment.payload.url}]`;
      break;
      
    case 'location':
      const { lat, long } = attachment.payload.coordinates;
      processed.coordinates = { lat, long };
      processed.description = `[Location: ${lat},${long}]`;
      break;
      
    case 'fallback':
      processed.description = `[Fallback: ${attachment.payload.title || 'Unsupported content'}]`;
      break;
      
    default:
      processed.description = `[Unsupported attachment type: ${attachment.type}]`;
  }
  
  return processed;
}

/**
 * Process Instagram-specific message format
 * 
 * @param {Object} value The value object from Instagram webhook
 * @returns {Object} Processed Instagram message
 */
function processInstagramMessage(value) {
  const senderId = value.sender.id;
  const recipientId = value.recipient.id;
  
  if (!value.messages || !value.messages.length) {
    return {
      senderId,
      recipientId,
      message: { text: '[Empty message]' },
      timestamp: Date.now()
    };
  }
  
  const message = value.messages[0];
  const timestamp = message.timestamp;
  
  // Process different Instagram message types
  let processedMessage = {};
  
  if (message.text) {
    processedMessage.text = message.text.body;
  } else if (message.attachments) {
    // Convert IG attachments to FB-style attachments
    processedMessage.attachments = message.attachments.map(att => ({
      type: att.type,
      payload: { url: att.url }
    }));
  } else if (message.replies) {
    // Handle quick replies
    processedMessage.quick_reply = {
      payload: message.replies[0].title
    };
  } else {
    processedMessage.text = '[Unsupported Instagram message format]';
  }
  
  return {
    senderId,
    recipientId,
    message: processedMessage,
    timestamp
  };
}

/**
 * Convert the processed message to Voiceflow-compatible format
 * 
 * @param {Object} processedMessage The processed message
 * @param {Object} userContext Additional context about the user/conversation
 * @returns {Object} Voiceflow-compatible request body
 */
function prepareVoiceflowRequest(processedMessage, userContext = {}) {
  const request = {
    action: {
      type: 'text',
      payload: processedMessage.text
    },
    config: {
      tts: false,
      stripSSML: true
    },
    state: {
      variables: {
        ...userContext,
        messageType: processedMessage.type,
        hasAttachments: processedMessage.attachments.length > 0,
        messageMetadata: processedMessage.metadata
      }
    }
  };
  
  // Add attachment info if present
  if (processedMessage.attachments.length > 0) {
    request.state.variables.attachments = processedMessage.attachments;
  }
  
  // Add quick replies if present
  if (processedMessage.quickReplies.length > 0) {
    request.state.variables.quickReplies = processedMessage.quickReplies;
  }
  
  return request;
}

/**
 * Format Voiceflow response for sending back to Meta platforms
 * 
 * @param {Array} voiceflowResponse The response array from Voiceflow
 * @returns {Object} Formatted response ready for Meta
 */
function formatVoiceflowResponse(voiceflowResponse) {
  if (!voiceflowResponse || !Array.isArray(voiceflowResponse)) {
    return { text: "I'm sorry, I couldn't process your request at this time." };
  }
  
  let formattedResponse = {
    text: '',
    quick_replies: [],
    attachment: null
  };
  
  // Process different Voiceflow response types
  voiceflowResponse.forEach(item => {
    if (item.type === 'text' && item.payload?.message) {
      // Concatenate text responses
      if (formattedResponse.text) {
        formattedResponse.text += '\n\n' + item.payload.message;
      } else {
        formattedResponse.text = item.payload.message;
      }
    } 
    else if (item.type === 'choice' && item.payload?.buttons) {
      // Convert choice items to quick replies
      item.payload.buttons.forEach(button => {
        if (formattedResponse.quick_replies.length < 13) { // Meta limit
          formattedResponse.quick_replies.push({
            content_type: 'text',
            title: button.name,
            payload: button.request.payload
          });
        }
      });
    }
    else if (item.type === 'visual' && item.payload?.image) {
      // Handle image responses
      formattedResponse.attachment = {
        type: 'image',
        payload: {
          url: item.payload.image,
          is_reusable: true
        }
      };
    }
  });
  
  // If no text was found but we have an attachment, add a default message
  if (!formattedResponse.text && formattedResponse.attachment) {
    formattedResponse.text = 'Here you go!';
  }
  
  // If no text was found at all, add a fallback message
  if (!formattedResponse.text) {
    formattedResponse.text = "I'm sorry, I couldn't process your request at this time.";
  }
  
  return formattedResponse;
}

module.exports = {
  processMetaMessage,
  processInstagramMessage,
  prepareVoiceflowRequest,
  formatVoiceflowResponse
};