export interface User {
  id: string;
  email: string;
  role?: string;
  created_at: string;
  isAuthenticated?: boolean; // Added to track authentication status explicitly
}

export interface SocialConnection {
  id: string;
  user_id: string;
  fb_page_id?: string;
  ig_account_id?: string;
  access_token: string;
  token_expiry: string;
  refreshed_at?: string;
  created_at?: string;
}

export interface TokenRefreshHistory {
  connectionId: string;
  platformType: string;
  platformId: string;
  lastRefreshed: string;
  currentExpiry: string;
}

export interface TokenRefreshResult {
  id: string;
  platform: string;
  status: 'success' | 'error';
  new_expiry?: string;
  error?: string;
}

export interface VoiceflowMapping {
  id: string;
  user_id: string;
  vf_project_id: string;
  flowbridge_config: Record<string, any>;
  created_at?: string;
}

export interface VoiceflowApiKey {
  id: string;
  user_id: string;
  api_key: string;
  created_at?: string;
  updated_at?: string;
}

export interface WebhookConfig {
  id: string;
  user_id: string;
  webhook_url?: string;
  verification_token?: string;
  is_active: boolean;
  created_at?: string;
  updated_at?: string;
  platform?: 'all' | 'facebook' | 'instagram' | 'whatsapp';
  webhook_name?: string;
  generated_url?: string;
  webhook_token?: string;
  channel_name?: string;
  channel_id?: string;
  meta_verification_status?: 'pending' | 'verified' | 'failed';
  additional_config?: Record<string, any>;
}

export interface MessageAnalytics {
  name: string;  // weekday short name
  date: string;  // full date
  messages: number;  // total messages
  facebook: number;  // facebook messages count
  instagram: number;  // instagram messages count
  userMessages: number;  // messages from users
  assistantMessages: number;  // messages from assistant
}

export interface DashboardStats {
  messageCount: number;
  conversationCount: number;
  responseTime: number;
  successRate: number;
  facebookPercentage: number;
  instagramPercentage: number;
}

export interface Conversation {
  id: string;
  user_id: string;
  platform: 'facebook' | 'instagram';
  external_id: string;
  participant_id: string;
  participant_name?: string;
  last_message_at: string;
  created_at?: string;
  latest_message?: Message;
  unread_count?: number;
}

export interface Message {
  id: string;
  conversation_id: string;
  content: string;
  sender_type: 'user' | 'assistant';
  external_id?: string;
  sent_at: string;
  created_at?: string;
}

export interface ApiRateLimit {
  id: string;
  user_id: string;
  platform: string;
  endpoint: string;
  calls_made: number;
  reset_at: string;
  created_at?: string;
}

export type LoadingState = 'idle' | 'loading' | 'success' | 'error';

export interface ErrorState {
  message: string;
  details?: string;
}

export interface UserSummary {
  id: string;
  email: string;
  role: string;
  created_at: string;
  connections: {
    facebook: boolean;
    instagram: boolean;
  };
  voiceflow: boolean;
  webhook: boolean;
  conversationCount: number;
  messageCount: number;
}

// Facebook-specific interfaces
export interface FacebookAuthResponse {
  accessToken: string;
  expiresIn: number;
  signedRequest: string;
  userID: string;
}

export interface FacebookStatusResponse {
  status: 'connected' | 'not_authorized' | 'unknown';
  authResponse: FacebookAuthResponse | null;
}

// Authentication status interface
export interface AuthStatus {
  isAuthenticated: boolean; 
  isAdmin: boolean;
  user: User | null;
  loading: boolean;
  error: string | null;
}