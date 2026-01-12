import { CredentialProviderRegistry } from './credential-provider-registry';
import type {
  TApiKeyCredentialProvider,
  TOAuthCredentialProvider,
} from './credential-provider-types';

describe('CredentialProviderRegistry', () => {
  let registry: CredentialProviderRegistry;

  beforeEach(() => {
    registry = new CredentialProviderRegistry();
  });

  // ==========================================================================
  // Valid Provider Registration
  // ==========================================================================

  describe('register()', () => {
    it('should register a valid API key provider', () => {
      const provider: TApiKeyCredentialProvider = {
        id: 'openai_api_key',
        displayName: 'OpenAI API Key',
        description: 'API key for OpenAI',
        icon: 'openai',
        collectionMethod: 'api_key',
        fields: [
          {
            name: 'api_key',
            label: 'API Key',
            type: 'password',
            required: true,
          },
        ],
      };

      registry.register(provider);

      expect(registry.has('openai_api_key')).toBe(true);
      expect(registry.get('openai_api_key')).toEqual(provider);
    });

    it('should register a valid OAuth provider', () => {
      const provider: TOAuthCredentialProvider = {
        id: 'notion_oauth',
        displayName: 'Notion OAuth',
        collectionMethod: 'oauth',
        oauth: {
          authorizationUrl: 'https://api.notion.com/v1/oauth/authorize',
          tokenUrl: 'https://api.notion.com/v1/oauth/token',
          clientIdEnvVar: 'NOTION_CLIENT_ID',
          clientSecretEnvVar: 'NOTION_CLIENT_SECRET',
          scopes: [],
        },
      };

      registry.register(provider);

      expect(registry.has('notion_oauth')).toBe(true);
    });

    it('should register multiple providers', () => {
      const provider1: TApiKeyCredentialProvider = {
        id: 'provider_one',
        displayName: 'Provider One',
        collectionMethod: 'api_key',
        fields: [{ name: 'key', label: 'Key', type: 'password' }],
      };

      const provider2: TApiKeyCredentialProvider = {
        id: 'provider_two',
        displayName: 'Provider Two',
        collectionMethod: 'api_key',
        fields: [{ name: 'token', label: 'Token', type: 'password' }],
      };

      registry.register(provider1);
      registry.register(provider2);

      expect(registry.getAll()).toHaveLength(2);
    });
  });

  // ==========================================================================
  // Invalid Provider Registration
  // ==========================================================================

  describe('register() validation errors', () => {
    it('should throw error for duplicate provider ID', () => {
      const provider: TApiKeyCredentialProvider = {
        id: 'duplicate_id',
        displayName: 'Provider',
        collectionMethod: 'api_key',
        fields: [{ name: 'key', label: 'Key', type: 'password' }],
      };

      registry.register(provider);

      expect(() => registry.register(provider)).toThrow(
        "Credential provider 'duplicate_id' is already registered"
      );
    });

    it('should throw error for invalid provider ID format (starts with number)', () => {
      const provider = {
        id: '123invalid',
        displayName: 'Invalid Provider',
        collectionMethod: 'api_key' as const,
        fields: [{ name: 'key', label: 'Key', type: 'password' as const }],
      };

      expect(() => registry.register(provider)).toThrow(
        "Invalid provider ID '123invalid'"
      );
    });

    it('should throw error for invalid provider ID format (uppercase)', () => {
      const provider = {
        id: 'UPPERCASE',
        displayName: 'Invalid Provider',
        collectionMethod: 'api_key' as const,
        fields: [{ name: 'key', label: 'Key', type: 'password' as const }],
      };

      expect(() => registry.register(provider)).toThrow(
        "Invalid provider ID 'UPPERCASE'"
      );
    });

    it('should throw error for empty displayName', () => {
      const provider = {
        id: 'valid_id',
        displayName: '   ',
        collectionMethod: 'api_key' as const,
        fields: [{ name: 'key', label: 'Key', type: 'password' as const }],
      };

      expect(() => registry.register(provider)).toThrow(
        "Provider 'valid_id' must have a displayName"
      );
    });

    it('should throw error for API key provider without fields', () => {
      const provider = {
        id: 'no_fields',
        displayName: 'No Fields Provider',
        collectionMethod: 'api_key' as const,
        fields: [],
      };

      expect(() => registry.register(provider)).toThrow(
        "API key provider 'no_fields' must have at least one field"
      );
    });

    it('should throw error for field without name', () => {
      const provider = {
        id: 'bad_field',
        displayName: 'Bad Field Provider',
        collectionMethod: 'api_key' as const,
        fields: [{ name: '', label: 'Key', type: 'password' as const }],
      };

      expect(() => registry.register(provider)).toThrow(
        "Field 0 in provider 'bad_field' must have name and label"
      );
    });

    it('should throw error for field with invalid type', () => {
      const provider = {
        id: 'invalid_type',
        displayName: 'Invalid Type Provider',
        collectionMethod: 'api_key' as const,
        fields: [
          { name: 'key', label: 'Key', type: 'invalid' as 'text' | 'password' },
        ],
      };

      expect(() => registry.register(provider)).toThrow(
        "Field 'key' in provider 'invalid_type' has invalid type"
      );
    });

    it('should throw error for OAuth provider without oauth config', () => {
      const provider = {
        id: 'no_oauth',
        displayName: 'No OAuth Config',
        collectionMethod: 'oauth' as const,
      } as TOAuthCredentialProvider;

      expect(() => registry.register(provider)).toThrow(
        "OAuth provider 'no_oauth' must have oauth configuration"
      );
    });

    it('should throw error for OAuth provider without authorizationUrl', () => {
      const provider = {
        id: 'missing_url',
        displayName: 'Missing URL',
        collectionMethod: 'oauth' as const,
        oauth: {
          authorizationUrl: '',
          tokenUrl: 'https://example.com/token',
          clientIdEnvVar: 'CLIENT_ID',
          clientSecretEnvVar: 'CLIENT_SECRET',
          scopes: [],
        },
      };

      expect(() => registry.register(provider)).toThrow(
        "OAuth provider 'missing_url' must have authorizationUrl and tokenUrl"
      );
    });

    it('should throw error for OAuth provider without clientIdEnvVar', () => {
      const provider = {
        id: 'missing_env',
        displayName: 'Missing Env',
        collectionMethod: 'oauth' as const,
        oauth: {
          authorizationUrl: 'https://example.com/auth',
          tokenUrl: 'https://example.com/token',
          clientIdEnvVar: '',
          clientSecretEnvVar: 'CLIENT_SECRET',
          scopes: [],
        },
      };

      expect(() => registry.register(provider)).toThrow(
        "OAuth provider 'missing_env' must specify clientIdEnvVar and clientSecretEnvVar"
      );
    });
  });

  // ==========================================================================
  // Retrieval Methods
  // ==========================================================================

  describe('get()', () => {
    it('should return undefined for non-existent provider', () => {
      expect(registry.get('nonexistent')).toBeUndefined();
    });

    it('should return registered provider', () => {
      const provider: TApiKeyCredentialProvider = {
        id: 'test_provider',
        displayName: 'Test Provider',
        collectionMethod: 'api_key',
        fields: [{ name: 'key', label: 'Key', type: 'password' }],
      };

      registry.register(provider);

      expect(registry.get('test_provider')).toEqual(provider);
    });
  });

  describe('getAll()', () => {
    it('should return empty array when no providers registered', () => {
      expect(registry.getAll()).toEqual([]);
    });

    it('should return all registered providers', () => {
      const provider1: TApiKeyCredentialProvider = {
        id: 'provider_a',
        displayName: 'Provider A',
        collectionMethod: 'api_key',
        fields: [{ name: 'key', label: 'Key', type: 'password' }],
      };

      const provider2: TOAuthCredentialProvider = {
        id: 'provider_b',
        displayName: 'Provider B',
        collectionMethod: 'oauth',
        oauth: {
          authorizationUrl: 'https://example.com/auth',
          tokenUrl: 'https://example.com/token',
          clientIdEnvVar: 'CLIENT_ID',
          clientSecretEnvVar: 'CLIENT_SECRET',
          scopes: ['read'],
        },
      };

      registry.register(provider1);
      registry.register(provider2);

      const all = registry.getAll();
      expect(all).toHaveLength(2);
      expect(all).toContainEqual(provider1);
      expect(all).toContainEqual(provider2);
    });
  });

  describe('getByCollectionMethod()', () => {
    beforeEach(() => {
      const apiKeyProvider: TApiKeyCredentialProvider = {
        id: 'api_key_provider',
        displayName: 'API Key',
        collectionMethod: 'api_key',
        fields: [{ name: 'key', label: 'Key', type: 'password' }],
      };

      const oauthProvider: TOAuthCredentialProvider = {
        id: 'oauth_provider',
        displayName: 'OAuth',
        collectionMethod: 'oauth',
        oauth: {
          authorizationUrl: 'https://example.com/auth',
          tokenUrl: 'https://example.com/token',
          clientIdEnvVar: 'CLIENT_ID',
          clientSecretEnvVar: 'CLIENT_SECRET',
          scopes: [],
        },
      };

      registry.register(apiKeyProvider);
      registry.register(oauthProvider);
    });

    it('should return only API key providers', () => {
      const apiKeyProviders = registry.getByCollectionMethod('api_key');
      expect(apiKeyProviders).toHaveLength(1);
      expect(apiKeyProviders[0].id).toBe('api_key_provider');
    });

    it('should return only OAuth providers', () => {
      const oauthProviders = registry.getByCollectionMethod('oauth');
      expect(oauthProviders).toHaveLength(1);
      expect(oauthProviders[0].id).toBe('oauth_provider');
    });
  });

  describe('has()', () => {
    it('should return false for non-existent provider', () => {
      expect(registry.has('nonexistent')).toBe(false);
    });

    it('should return true for registered provider', () => {
      const provider: TApiKeyCredentialProvider = {
        id: 'exists',
        displayName: 'Exists',
        collectionMethod: 'api_key',
        fields: [{ name: 'key', label: 'Key', type: 'password' }],
      };

      registry.register(provider);

      expect(registry.has('exists')).toBe(true);
    });
  });
});
