// Mock the database module BEFORE importing anything that uses it
jest.mock('../database/pg', () => ({
  pg: {
    query: jest.fn(),
  },
}));

// Mock the config module
jest.mock('../config', () => ({
  CONFIG: {
    APP_FRONTEND_URL: 'http://localhost:3000',
    APP_FRONTEND_URL_DEV: 'http://localhost:3001',
  },
}));

// Mock the log module
jest.mock('@holistix-forge/log', () => ({
  EPriority: {
    Debug: 'debug',
    Error: 'error',
  },
  log: jest.fn(),
  error: jest.fn(),
}));

// Mock backend-engine to avoid ES module issues
jest.mock('@holistix-forge/backend-engine', () => ({
  development: jest.fn((fn) => fn()),
  generateJwtToken: jest.fn(
    (payload) => `jwt-token-${JSON.stringify(payload)}`
  ),
}));

// Mock simple-types
jest.mock('@holistix-forge/simple-types', () => ({
  makeUuid: jest.fn(() => 'test-uuid-123'),
}));

// Mock types
jest.mock('@holistix-forge/types', () => ({
  GLOBAL_CLIENT_ID: 'app-main-client-id',
}));

// Mock auth/totp
jest.mock('../routes/auth/totp', () => ({
  userFromSession: jest.fn(),
}));

// Import after mocks
import { model } from './oauth';
import { pg } from '../database/pg';

describe('OAuth Model', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('getRefreshToken - Null Safety', () => {
    it('should handle null query result safely (no crash)', async () => {
      // Arrange: Mock pg.query to return null from next()
      const mockQuery = jest.mocked(pg.query);
      mockQuery.mockResolvedValue({
        next: () => null,
      } as any);

      // Act - This should not crash (previously would crash with "Cannot read properties of null")
      const result = await model.getRefreshToken('invalid-token');

      // Assert
      expect(result).toBe(false);
    });

    it('should handle undefined query result safely (no crash)', async () => {
      // Arrange: Mock pg.query to return undefined from next()
      const mockQuery = jest.mocked(pg.query);
      mockQuery.mockResolvedValue({
        next: () => undefined,
      } as any);

      // Act - This should not crash (previously would crash with "Cannot read properties of undefined")
      const result = await model.getRefreshToken('invalid-token');

      // Assert
      expect(result).toBe(false);
    });
  });

  describe('getAuthorizationCode - Null Safety', () => {
    it('should handle null query result safely (no crash)', async () => {
      // Arrange: Mock pg.query to return null from next()
      const mockQuery = jest.mocked(pg.query);
      mockQuery.mockResolvedValue({
        next: () => null,
      } as any);

      // Act - This should not crash (previously would crash with "Cannot read properties of null")
      const result = await model.getAuthorizationCode('invalid-code');

      // Assert
      expect(result).toBe(false);
    });

    it('should handle undefined query result safely (no crash)', async () => {
      // Arrange: Mock pg.query to return undefined from next()
      const mockQuery = jest.mocked(pg.query);
      mockQuery.mockResolvedValue({
        next: () => undefined,
      } as any);

      // Act - This should not crash (previously would crash with "Cannot read properties of undefined")
      const result = await model.getAuthorizationCode('invalid-code');

      // Assert
      expect(result).toBe(false);
    });
  });

  describe('getClient', () => {
    it('should return client for global client ID', async () => {
      // Act
      const result = await model.getClient('app-main-client-id', 'any-secret');

      // Assert
      expect(result).toEqual({
        id: 'app-main-client-id',
        grants: ['authorization_code', 'refresh_token'],
        redirectUris: ['http://localhost:3000', 'http://localhost:3001'],
        accessTokenLifetime: expect.any(Number),
        refreshTokenLifetime: expect.any(Number),
      });
    });

    it('should return false for unknown client ID', async () => {
      // Act
      const result = await model.getClient('unknown-client-id', 'secret');

      // Assert
      expect(result).toBe(false);
    });
  });

  describe('saveAuthorizationCode - PKCE', () => {
    const client = { id: 'holistix-runner', grants: ['authorization_code'] };
    const user = {
      id: 'user-123',
      username: 'testuser',
      session_id: 'session-456',
    };

    it('should persist the code challenge it was given', async () => {
      // Arrange
      const mockQuery = jest.mocked(pg.query);
      mockQuery.mockResolvedValue(undefined as any);

      const code = {
        authorizationCode: 'code-abc',
        expiresAt: new Date('2026-01-01T00:00:00Z'),
        redirectUri: 'http://127.0.0.1:54321/callback',
        scope: ['read'],
        codeChallenge: 'E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM',
        codeChallengeMethod: 'S256',
      };

      // Act
      const result = await model.saveAuthorizationCode(code, client, user);

      // Assert - the challenge reaches the database, or nothing verifies later
      expect(mockQuery).toHaveBeenCalledWith(
        'call proc_oauth_tokens_save_code($1, $2, $3, $4, $5, $6, $7, $8)',
        [
          'holistix-runner',
          'session-456',
          'code-abc',
          code.expiresAt,
          JSON.stringify(['read']),
          'http://127.0.0.1:54321/callback',
          'E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM',
          'S256',
        ]
      );
      expect(result).toMatchObject({
        codeChallenge: 'E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM',
        codeChallengeMethod: 'S256',
      });
    });

    it('should pass nulls for a client that sent no challenge', async () => {
      // Arrange
      const mockQuery = jest.mocked(pg.query);
      mockQuery.mockResolvedValue(undefined as any);

      const code = {
        authorizationCode: 'code-abc',
        expiresAt: new Date('2026-01-01T00:00:00Z'),
        redirectUri: 'https://example.com',
        scope: ['read'],
      };

      // Act
      await model.saveAuthorizationCode(code as any, client, user);

      // Assert
      const params = jest.mocked(pg.query).mock.calls[0][1] as unknown[];
      expect(params[6]).toBeNull();
      expect(params[7]).toBeNull();
    });
  });

  describe('getAuthorizationCode - PKCE', () => {
    const rowBase = {
      code: 'code-abc',
      code_expires_on: new Date('2026-01-01T00:00:00Z'),
      code_redirect_uri: 'http://127.0.0.1:54321/callback',
      scope: ['read'],
      client_id: 'holistix-runner',
      client_grants: ['authorization_code'],
      user_id: 'user-123',
      username: 'testuser',
      session_id: 'session-456',
    };

    const mockRow = (row: Record<string, unknown>) => {
      jest.mocked(pg.query).mockResolvedValue({
        next: () => ({ oneRow: () => row }),
      } as any);
    };

    it('should return the stored challenge so the verifier gets checked', async () => {
      // Arrange
      mockRow({
        ...rowBase,
        code_challenge: 'E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM',
        code_challenge_method: 'S256',
      });

      // Act
      const result = await model.getAuthorizationCode('code-abc');

      // Assert
      expect(result).toMatchObject({
        codeChallenge: 'E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM',
        codeChallengeMethod: 'S256',
      });
    });

    it('should omit the challenge entirely when the code has none', async () => {
      // Arrange - a confidential client's code: both columns null
      mockRow({
        ...rowBase,
        code_challenge: null,
        code_challenge_method: null,
      });

      // Act
      const result = await model.getAuthorizationCode('code-abc');

      // Assert - absent, not null: the library treats any truthy challenge as
      // "a verifier is required" and would reject a valid confidential exchange
      expect(result).not.toHaveProperty('codeChallenge');
      expect(result).not.toHaveProperty('codeChallengeMethod');
    });
  });

  describe('validateRedirectUri', () => {
    const runner = {
      id: 'holistix-runner',
      grants: ['authorization_code'],
      redirectUris: ['http://127.0.0.1/callback', 'http://[::1]/callback'],
    };

    it('should accept a loopback redirect on any port', async () => {
      // Act
      const result = await model.validateRedirectUri?.(
        'http://127.0.0.1:54321/callback',
        runner
      );

      // Assert - the runner cannot register the port it will be given
      expect(result).toBe(true);
    });

    it('should accept the IPv6 loopback on any port', async () => {
      // Act
      const result = await model.validateRedirectUri?.(
        'http://[::1]:8123/callback',
        runner
      );

      // Assert
      expect(result).toBe(true);
    });

    it('should reject a different path on loopback', async () => {
      // Act
      const result = await model.validateRedirectUri?.(
        'http://127.0.0.1:54321/steal',
        runner
      );

      // Assert
      expect(result).toBe(false);
    });

    it('should reject a non-loopback host', async () => {
      // Act - the port exception must not become "any host"
      const result = await model.validateRedirectUri?.(
        'http://evil.example.com:54321/callback',
        runner
      );

      // Assert
      expect(result).toBe(false);
    });

    it('should reject localhost, whose resolution is not ours to trust', async () => {
      // Act
      const result = await model.validateRedirectUri?.(
        'http://localhost:54321/callback',
        runner
      );

      // Assert
      expect(result).toBe(false);
    });

    it('should reject a loopback redirect carrying its own query', async () => {
      // Act
      const result = await model.validateRedirectUri?.(
        'http://127.0.0.1:54321/callback?next=http://evil.example.com',
        runner
      );

      // Assert
      expect(result).toBe(false);
    });

    it('should keep exact matching for a client with no loopback URI', async () => {
      // Arrange
      const web = {
        id: 'app-main-client-id',
        grants: ['authorization_code'],
        redirectUris: ['https://example.com/callback'],
      };

      // Act
      const exact = await model.validateRedirectUri?.(
        'https://example.com/callback',
        web
      );
      const other = await model.validateRedirectUri?.(
        'https://example.com/elsewhere',
        web
      );

      // Assert
      expect(exact).toBe(true);
      expect(other).toBe(false);
    });

    it('should reject anything for a client with no registered URIs', async () => {
      // Act
      const result = await model.validateRedirectUri?.(
        'http://127.0.0.1:54321/callback',
        { id: 'bare', grants: ['authorization_code'] }
      );

      // Assert
      expect(result).toBe(false);
    });
  });

  describe('saveToken', () => {
    it('should save token successfully', async () => {
      // Arrange
      const mockQuery = jest.mocked(pg.query);
      mockQuery.mockResolvedValue(undefined as any);

      const client = {
        id: 'test-client',
        grants: ['authorization_code'],
      };
      const user = {
        id: 'user-123',
        username: 'testuser',
        session_id: 'session-456',
      };
      const token = {
        accessToken: 'access-token',
        accessTokenExpiresAt: new Date('2025-12-31T23:59:59Z'),
        refreshToken: 'refresh-token',
        refreshTokenExpiresAt: new Date('2026-01-07T23:59:59Z'),
        scope: ['read', 'write'],
        client,
        user,
      };

      // Act
      const result = await model.saveToken(token, client, user);

      // Assert
      expect(result).toEqual({
        ...token,
        client,
        user,
      });
      expect(mockQuery).toHaveBeenCalledWith(
        'call proc_oauth_tokens_save_tokens($1, $2, $3, $4, $5, $6, $7)',
        [
          'test-client',
          'session-456',
          JSON.stringify(['read', 'write']),
          'access-token',
          token.accessTokenExpiresAt,
          'refresh-token',
          token.refreshTokenExpiresAt,
        ]
      );
    });

    it('should return false when database error occurs', async () => {
      // Arrange
      const mockQuery = jest.mocked(pg.query);
      mockQuery.mockRejectedValue(new Error('Database connection failed'));

      const client = { id: 'test-client', grants: ['authorization_code'] };
      const user = {
        id: 'user-123',
        username: 'testuser',
        session_id: 'session-456',
      };
      const token = {
        accessToken: 'access-token',
        accessTokenExpiresAt: new Date(),
        refreshToken: 'refresh-token',
        refreshTokenExpiresAt: new Date(),
        scope: ['read'],
        client,
        user,
      };

      // Act
      const result = await model.saveToken(token, client, user);

      // Assert
      expect(result).toBe(false);
    });
  });

  describe('revokeToken', () => {
    it('should revoke token successfully', async () => {
      // Arrange
      const mockQuery = jest.mocked(pg.query);
      mockQuery.mockResolvedValue(undefined as any);

      const token = {
        refreshToken: 'token-to-revoke',
      };

      // Act
      const result = await model.revokeToken(token as any);

      // Assert
      expect(result).toBe(true);
      expect(mockQuery).toHaveBeenCalledWith(
        'call proc_oauth_tokens_revoke_token($1)',
        ['token-to-revoke']
      );
    });

    it('should return false when database error occurs', async () => {
      // Arrange
      const mockQuery = jest.mocked(pg.query);
      mockQuery.mockRejectedValue(new Error('Database error'));

      const token = {
        refreshToken: 'token-to-revoke',
      };

      // Act
      const result = await model.revokeToken(token as any);

      // Assert
      expect(result).toBe(false);
    });
  });

  describe('revokeAuthorizationCode', () => {
    it('should revoke authorization code successfully', async () => {
      // Arrange
      const mockQuery = jest.mocked(pg.query);
      mockQuery.mockResolvedValue(undefined as any);

      const code = {
        authorizationCode: 'code-to-revoke',
      };

      // Act
      const result = await model.revokeAuthorizationCode(code as any);

      // Assert
      expect(result).toBe(true);
      expect(mockQuery).toHaveBeenCalledWith(
        'call proc_oauth_tokens_revoke_code($1)',
        ['code-to-revoke']
      );
    });

    it('should return false when database error occurs', async () => {
      // Arrange
      const mockQuery = jest.mocked(pg.query);
      mockQuery.mockRejectedValue(new Error('Database error'));

      const code = {
        authorizationCode: 'code-to-revoke',
      };

      // Act
      const result = await model.revokeAuthorizationCode(code as any);

      // Assert
      expect(result).toBe(false);
    });
  });

  describe('validateScope', () => {
    it('should return validated scope when user has validated_scope', async () => {
      // Arrange
      const user = {
        id: 'user-123',
        username: 'testuser',
        session_id: 'session-456',
        validated_scope: ['read', 'write'],
      };
      const client = { id: 'test-client', grants: ['authorization_code'] };
      const scope = ['read', 'write', 'delete'];

      // Act
      const result = await model.validateScope?.(user, client, scope);

      // Assert
      expect(result).toEqual(['read', 'write']);
    });

    it('should return requested scope when user has no validated_scope', async () => {
      // Arrange
      const user = {
        id: 'user-123',
        username: 'testuser',
        session_id: 'session-456',
      };
      const client = { id: 'test-client', grants: ['authorization_code'] };
      const scope = ['read', 'write'];

      // Act
      const result = await model.validateScope?.(user, client, scope);

      // Assert
      expect(result).toEqual(['read', 'write']);
    });
  });
});
