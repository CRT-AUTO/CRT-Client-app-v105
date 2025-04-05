import { describe, it, expect, vi, beforeEach } from 'vitest';
import { processMessageWithVoiceflow } from '../src/lib/voiceflow';
import { supabase } from '../src/lib/supabase';
import { checkRateLimit, trackApiCall } from '../src/lib/api';

// Mock the needed dependencies
vi.mock('../src/lib/supabase', () => ({
  supabase: {
    auth: {
      getUser: vi.fn().mockResolvedValue({
        data: { user: { id: 'test-user-id' } }
      })
    }
  }
}));

vi.mock('../src/lib/api', () => ({
  getVoiceflowMappings: vi.fn().mockResolvedValue([{
    id: 'test-mapping-id',
    user_id: 'test-user-id',
    vf_project_id: 'test-project-id',
    flowbridge_config: {
      voiceflow: {
        project_id: 'test-project-id',
        version_id: 'latest'
      }
    }
  }]),
  checkRateLimit: vi.fn().mockResolvedValue(true),
  trackApiCall: vi.fn().mockResolvedValue({})
}));

describe('processMessageWithVoiceflow', () => {
  const mockConversation = {
    id: 'test-conversation-id',
    user_id: 'test-user-id',
    platform: 'facebook' as const,
    external_id: 'test-external-id',
    participant_id: 'test-participant-id',
    participant_name: 'Test User',
    last_message_at: new Date().toISOString(),
    created_at: new Date().toISOString()
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should process a hello message correctly', async () => {
    const response = await processMessageWithVoiceflow(mockConversation, 'hello');
    expect(response).toContain('Hi there!');
    expect(checkRateLimit).toHaveBeenCalledWith(
      'test-user-id',
      'voiceflow',
      'interact',
      expect.any(Number)
    );
    expect(trackApiCall).toHaveBeenCalledWith(
      'test-user-id',
      'voiceflow',
      'interact'
    );
  });

  it('should process a help message correctly', async () => {
    const response = await processMessageWithVoiceflow(mockConversation, 'I need help');
    expect(response).toContain('help');
  });

  it('should handle rate limiting', async () => {
    // Mock rate limit exceeded
    (checkRateLimit as any).mockResolvedValueOnce(false);
    
    await expect(processMessageWithVoiceflow(mockConversation, 'test message'))
      .rejects.toThrow('rate limit');
  });

  it('should add platform-specific information', async () => {
    const response = await processMessageWithVoiceflow(mockConversation, 'test message');
    expect(response).toContain('via Facebook');
  });

  it('should handle instagram platform', async () => {
    const instagramConversation = {
      ...mockConversation,
      platform: 'instagram' as const
    };
    
    const response = await processMessageWithVoiceflow(instagramConversation, 'test message');
    expect(response).toContain('via Instagram');
  });
});