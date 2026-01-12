import { CredentialManagerImpl } from './CredentialManager';
import type { TApiKeyCredentialProvider } from '@holistix-forge/gateway';

// Mock the log module
jest.mock('@holistix-forge/log', () => ({
  EPriority: {
    Info: 'Info',
    Warning: 'Warning',
    Error: 'Error',
    Debug: 'Debug',
  },
  log: jest.fn(),
}));

describe('CredentialManagerImpl', () => {
  let credentialManager: CredentialManagerImpl;
  let mockGanymedeClient: {
    request: jest.Mock;
  };

  beforeEach(() => {
    jest.clearAllMocks();
    credentialManager = new CredentialManagerImpl();

    // Mock Ganymede client
    mockGanymedeClient = {
      request: jest.fn(),
    };
    credentialManager.setGanymedeClient(mockGanymedeClient as any);

    // Register a test provider
    const testProvider: TApiKeyCredentialProvider = {
      id: 'test_provider',
      displayName: 'Test Provider',
      collectionMethod: 'api_key',
      fields: [
        { name: 'api_key', label: 'API Key', type: 'password', required: true },
      ],
    };
    credentialManager.getProviderRegistry().register(testProvider);
  });

  // ==========================================================================
  // Provider Registry
  // ==========================================================================

  describe('Provider Registry', () => {
    it('should return the provider registry', () => {
      const registry = credentialManager.getProviderRegistry();
      expect(registry).toBeDefined();
      expect(registry.has('test_provider')).toBe(true);
    });

    it('should return all registered providers', () => {
      const providers = credentialManager.getProviders();
      expect(providers).toHaveLength(1);
      expect(providers[0].id).toBe('test_provider');
    });

    it('should get provider by ID', () => {
      const provider = credentialManager.getProvider('test_provider');
      expect(provider).toBeDefined();
      expect(provider?.displayName).toBe('Test Provider');
    });

    it('should return undefined for unknown provider', () => {
      const provider = credentialManager.getProvider('unknown');
      expect(provider).toBeUndefined();
    });
  });

  // ==========================================================================
  // API Key Credential Creation
  // ==========================================================================

  describe('createApiKeyCredential()', () => {
    it('should create API key credential via Ganymede', async () => {
      const mockCredential = {
        id: 'cred-123',
        user_id: 'user-456',
        provider_id: 'test_provider',
        name: 'My API Key',
        collection_method: 'api_key',
        created_at: '2024-01-01T00:00:00Z',
        updated_at: '2024-01-01T00:00:00Z',
        is_active: true,
      };

      mockGanymedeClient.request.mockResolvedValue({
        credential: mockCredential,
      });

      const result = await credentialManager.createApiKeyCredential(
        'user-456',
        {
          provider_id: 'test_provider',
          name: 'My API Key',
          values: { api_key: 'sk-xxx123' },
        }
      );

      expect(result).toEqual(mockCredential);
      expect(mockGanymedeClient.request).toHaveBeenCalledWith({
        method: 'POST',
        url: '/credentials',
        headers: { 'Content-Type': 'application/json' },
        jsonBody: {
          type: 'test_provider',
          name: 'My API Key',
          value: JSON.stringify({ api_key: 'sk-xxx123' }),
          metadata: undefined,
        },
      });
    });

    it('should throw error for unknown provider', async () => {
      await expect(
        credentialManager.createApiKeyCredential('user-456', {
          provider_id: 'unknown_provider',
          name: 'Test',
          values: { key: 'value' },
        })
      ).rejects.toThrow('Unknown credential provider: unknown_provider');
    });

    it('should throw error if Ganymede client not initialized', async () => {
      const managerWithoutClient = new CredentialManagerImpl();
      managerWithoutClient.getProviderRegistry().register({
        id: 'test',
        displayName: 'Test',
        collectionMethod: 'api_key',
        fields: [{ name: 'key', label: 'Key', type: 'password' }],
      });

      await expect(
        managerWithoutClient.createApiKeyCredential('user', {
          provider_id: 'test',
          name: 'Test',
          values: { key: 'value' },
        })
      ).rejects.toThrow('Ganymede client not initialized');
    });
  });

  // ==========================================================================
  // Credential CRUD Operations
  // ==========================================================================

  describe('getCredential()', () => {
    it('should fetch credential from Ganymede', async () => {
      const mockCredential = { id: 'cred-123', name: 'Test' };
      mockGanymedeClient.request.mockResolvedValue({
        credential: mockCredential,
      });

      const result = await credentialManager.getCredential('cred-123');

      expect(result).toEqual(mockCredential);
      expect(mockGanymedeClient.request).toHaveBeenCalledWith({
        method: 'GET',
        url: '/credentials/cred-123',
      });
    });

    it('should return null on error', async () => {
      mockGanymedeClient.request.mockRejectedValue(new Error('Not found'));

      const result = await credentialManager.getCredential('nonexistent');

      expect(result).toBeNull();
    });
  });

  describe('listCredentials()', () => {
    it('should list credentials from Ganymede', async () => {
      const mockCredentials = [
        { id: 'cred-1', name: 'First' },
        { id: 'cred-2', name: 'Second' },
      ];
      mockGanymedeClient.request.mockResolvedValue({
        credentials: mockCredentials,
      });

      const result = await credentialManager.listCredentials('user-123');

      expect(result).toEqual(mockCredentials);
      expect(mockGanymedeClient.request).toHaveBeenCalledWith({
        method: 'GET',
        url: '/credentials',
        queryParameters: { include_shared: 'false' },
      });
    });

    it('should return empty array on error', async () => {
      mockGanymedeClient.request.mockRejectedValue(new Error('Failed'));

      const result = await credentialManager.listCredentials('user-123');

      expect(result).toEqual([]);
    });
  });

  describe('updateCredential()', () => {
    it('should update credential via Ganymede', async () => {
      const mockUpdated = { id: 'cred-123', name: 'Updated Name' };
      mockGanymedeClient.request.mockResolvedValue({ credential: mockUpdated });

      const result = await credentialManager.updateCredential('cred-123', {
        name: 'Updated Name',
      });

      expect(result).toEqual(mockUpdated);
      expect(mockGanymedeClient.request).toHaveBeenCalledWith({
        method: 'PATCH',
        url: '/credentials/cred-123',
        headers: { 'Content-Type': 'application/json' },
        jsonBody: { name: 'Updated Name' },
      });
    });

    it('should return null on error', async () => {
      mockGanymedeClient.request.mockRejectedValue(new Error('Failed'));

      const result = await credentialManager.updateCredential('cred-123', {
        name: 'New Name',
      });

      expect(result).toBeNull();
    });
  });

  describe('deleteCredential()', () => {
    it('should delete credential via Ganymede', async () => {
      mockGanymedeClient.request.mockResolvedValue({ success: true });

      const result = await credentialManager.deleteCredential('cred-123');

      expect(result).toBe(true);
      expect(mockGanymedeClient.request).toHaveBeenCalledWith({
        method: 'DELETE',
        url: '/credentials/cred-123',
      });
    });

    it('should return false on error', async () => {
      mockGanymedeClient.request.mockRejectedValue(new Error('Failed'));

      const result = await credentialManager.deleteCredential('cred-123');

      expect(result).toBe(false);
    });
  });

  // ==========================================================================
  // OAuth Flow State
  // ==========================================================================

  describe('OAuth State Management', () => {
    const testState = {
      state: 'random-state-string',
      provider_id: 'notion_oauth',
      name: 'My Notion',
      user_id: 'user-123',
      redirect_uri: 'https://app.local/callback',
      created_at: new Date().toISOString(),
      expires_at: new Date(Date.now() + 600000).toISOString(), // 10 min from now
    };

    it('should save OAuth state', () => {
      credentialManager.saveOAuthState(testState);

      const retrieved = credentialManager.consumeOAuthState(
        'random-state-string'
      );
      expect(retrieved).toEqual(testState);
    });

    it('should consume and remove OAuth state', () => {
      credentialManager.saveOAuthState(testState);

      const first = credentialManager.consumeOAuthState('random-state-string');
      const second = credentialManager.consumeOAuthState('random-state-string');

      expect(first).toEqual(testState);
      expect(second).toBeNull();
    });

    it('should return null for non-existent state', () => {
      const result = credentialManager.consumeOAuthState('nonexistent');
      expect(result).toBeNull();
    });

    it('should cleanup expired states', () => {
      const expiredState = {
        ...testState,
        state: 'expired-state',
        expires_at: new Date(Date.now() - 1000).toISOString(), // Expired
      };
      const validState = {
        ...testState,
        state: 'valid-state',
        expires_at: new Date(Date.now() + 600000).toISOString(), // Valid
      };

      credentialManager.saveOAuthState(expiredState);
      credentialManager.saveOAuthState(validState);

      credentialManager.cleanupExpiredOAuthStates();

      expect(credentialManager.consumeOAuthState('expired-state')).toBeNull();
      expect(credentialManager.consumeOAuthState('valid-state')).toEqual(
        validState
      );
    });
  });

  // ==========================================================================
  // Statistics
  // ==========================================================================

  describe('getStats()', () => {
    it('should return provider and state counts', () => {
      credentialManager.saveOAuthState({
        state: 'state-1',
        provider_id: 'test',
        name: 'Test',
        user_id: 'user',
        redirect_uri: 'https://app.local',
        created_at: new Date().toISOString(),
        expires_at: new Date(Date.now() + 600000).toISOString(),
      });

      const stats = credentialManager.getStats();

      expect(stats.providers).toBe(1); // test_provider from beforeEach
      expect(stats.pendingOAuthStates).toBe(1);
    });
  });
});
