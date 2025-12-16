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
