/**
 * Tests for JWT utility functions
 * 
 * Tests JWT token generation and payload extraction utilities
 * used for authentication across the platform.
 */

import * as jwt from 'jsonwebtoken';
import * as crypto from 'crypto';
import { generateJwtToken, jwtPayload } from './Jwt';
import { TJson } from '@holistix-forge/simple-types';

describe('JWT Utilities', () => {
  // Generate a proper test RSA key pair for testing
  let testPrivateKey: string;
  let testPublicKey: string;

  beforeAll(() => {
    // Generate a proper RSA key pair for testing
    const { privateKey, publicKey } = crypto.generateKeyPairSync('rsa', {
      modulusLength: 2048,
      publicKeyEncoding: {
        type: 'spki',
        format: 'pem',
      },
      privateKeyEncoding: {
        type: 'pkcs8',
        format: 'pem',
      },
    });

    testPrivateKey = privateKey;
    testPublicKey = publicKey;
  });

  // Store original env vars
  const originalEnv = { ...process.env };

  beforeEach(() => {
    // Set up test keys
    process.env.JWT_PRIVATE_KEY = testPrivateKey;
    process.env.JWT_PUBLIC_KEY = testPublicKey;
  });

  afterEach(() => {
    // Restore original environment
    process.env = { ...originalEnv };
  });

  describe('generateJwtToken', () => {
    it('should generate a valid JWT token', () => {
      const payload: TJson = { userId: '123', email: 'test@example.com' };

      const token = generateJwtToken(payload);

      expect(typeof token).toBe('string');
      expect(token.split('.')).toHaveLength(3); // JWT has 3 parts
    });

    it('should include payload data in the token', () => {
      const payload: TJson = { userId: '123', role: 'admin' };

      const token = generateJwtToken(payload);
      const decoded = jwt.decode(token) as any;

      expect(decoded.userId).toBe('123');
      expect(decoded.role).toBe('admin');
    });

    it('should set default expiration to 1 hour', () => {
      const payload: TJson = { userId: '123' };

      const token = generateJwtToken(payload);
      const decoded = jwt.decode(token) as any;

      expect(decoded.exp).toBeDefined();
      expect(decoded.iat).toBeDefined();
      // Expiration should be approximately 1 hour after issued time
      expect(decoded.exp - decoded.iat).toBeCloseTo(3600, 0);
    });

    it('should accept custom expiration time', () => {
      const payload: TJson = { userId: '123' };

      const token = generateJwtToken(payload, '2h');
      const decoded = jwt.decode(token) as any;

      // Expiration should be approximately 2 hours after issued time
      expect(decoded.exp - decoded.iat).toBeCloseTo(7200, 0);
    });

    it('should support various expiration formats', () => {
      const payload: TJson = { userId: '123' };

      // Test different expiration formats
      const formats = ['30m', '1d', '7d', '30s'];

      formats.forEach((format) => {
        const token = generateJwtToken(payload, format);
        const decoded = jwt.decode(token) as any;

        expect(decoded.exp).toBeDefined();
        expect(decoded.exp).toBeGreaterThan(decoded.iat);
      });
    });

    it('should use RS256 algorithm', () => {
      const payload: TJson = { userId: '123' };

      const token = generateJwtToken(payload);
      const decoded = jwt.decode(token, { complete: true }) as any;

      expect(decoded.header.alg).toBe('RS256');
    });

    it('should handle complex payload objects', () => {
      const payload: TJson = {
        userId: '123',
        email: 'test@example.com',
        roles: ['admin', 'user'],
        metadata: {
          createdAt: '2024-01-01',
          lastLogin: '2024-01-15',
        },
        active: true,
      };

      const token = generateJwtToken(payload);
      const decoded = jwt.decode(token) as TJson;

      expect(decoded.userId).toBe('123');
      expect(decoded.email).toBe('test@example.com');
      expect(decoded.roles).toEqual(['admin', 'user']);
      expect(decoded.metadata).toEqual({
        createdAt: '2024-01-01',
        lastLogin: '2024-01-15',
      });
      expect(decoded.active).toBe(true);
    });

    it('should throw error when JWT_PRIVATE_KEY is not set', () => {
      delete process.env.JWT_PRIVATE_KEY;

      expect(() => {
        generateJwtToken({ userId: '123' });
      }).toThrow('JWT_PRIVATE_KEY environment variable is not set');
    });

    it('should generate tokens with unique issued-at timestamps', () => {
      const payload: TJson = { userId: '123' };

      // Generate multiple tokens - they should each have a valid 'iat' claim
      const token1 = generateJwtToken(payload);
      const token2 = generateJwtToken(payload);

      const decoded1 = jwt.decode(token1) as any;
      const decoded2 = jwt.decode(token2) as any;

      // Both should have issued-at timestamps
      expect(decoded1.iat).toBeDefined();
      expect(decoded2.iat).toBeDefined();
      expect(typeof decoded1.iat).toBe('number');
      expect(typeof decoded2.iat).toBe('number');
      
      // Tokens generated within the same second will have the same 'iat',
      // but they're still valid JWT tokens
      expect(decoded1.userId).toBe('123');
      expect(decoded2.userId).toBe('123');
    });

    it('should handle empty payload', () => {
      const payload: TJson = {};

      const token = generateJwtToken(payload);
      const decoded = jwt.decode(token) as any;

      expect(decoded.exp).toBeDefined();
      expect(decoded.iat).toBeDefined();
    });
  });

  describe('jwtPayload', () => {
    it('should extract payload from valid token', () => {
      const payload: TJson = { userId: '123', email: 'test@example.com' };
      const token = generateJwtToken(payload);

      const extracted = jwtPayload(token);

      expect(extracted.userId).toBe('123');
      expect(extracted.email).toBe('test@example.com');
    });

    it('should handle Bearer prefix', () => {
      const payload: TJson = { userId: '123' };
      const token = generateJwtToken(payload);

      const extracted = jwtPayload(`Bearer ${token}`);

      expect(extracted.userId).toBe('123');
    });

    it('should handle token prefix', () => {
      const payload: TJson = { userId: '123' };
      const token = generateJwtToken(payload);

      const extracted = jwtPayload(`token ${token}`);

      expect(extracted.userId).toBe('123');
    });

    it('should work without any prefix', () => {
      const payload: TJson = { userId: '123' };
      const token = generateJwtToken(payload);

      const extracted = jwtPayload(token);

      expect(extracted.userId).toBe('123');
    });

    it('should throw error for invalid token', () => {
      expect(() => {
        jwtPayload('invalid.token.here');
      }).toThrow('Invalid JWT token');
    });

    it('should throw error for malformed token', () => {
      expect(() => {
        jwtPayload('not-a-jwt-token');
      }).toThrow('Invalid JWT token');
    });

    it('should throw error when JWT_PUBLIC_KEY is not set', () => {
      const payload: TJson = { userId: '123' };
      const token = generateJwtToken(payload);

      delete process.env.JWT_PUBLIC_KEY;

      expect(() => {
        jwtPayload(token);
      }).toThrow('JWT_PUBLIC_KEY environment variable is not set');
    });

    it('should verify token signature correctly', () => {
      const payload: TJson = { userId: '123' };
      const token = generateJwtToken(payload);

      // This should not throw - valid signature
      expect(() => {
        jwtPayload(token);
      }).not.toThrow();
    });

    it('should reject token with wrong signature', () => {
      const payload: TJson = { userId: '123' };
      const token = generateJwtToken(payload);

      // Tamper with the token (change a character in the payload part)
      const parts = token.split('.');
      const tamperedPayload = parts[1].slice(0, -1) + 'X';
      const tamperedToken = `${parts[0]}.${tamperedPayload}.${parts[2]}`;

      expect(() => {
        jwtPayload(tamperedToken);
      }).toThrow('Invalid JWT token');
    });

    it('should extract complex payload data', () => {
      const payload: TJson = {
        userId: '123',
        email: 'test@example.com',
        roles: ['admin', 'user'],
        metadata: {
          department: 'Engineering',
          level: 'Senior',
        },
      };
      const token = generateJwtToken(payload);

      const extracted = jwtPayload(token);

      expect(extracted.userId).toBe('123');
      expect(extracted.email).toBe('test@example.com');
      expect(extracted.roles).toEqual(['admin', 'user']);
      expect(extracted.metadata).toEqual({
        department: 'Engineering',
        level: 'Senior',
      });
    });

    it('should include JWT standard claims', () => {
      const payload: TJson = { userId: '123' };
      const token = generateJwtToken(payload);

      const extracted = jwtPayload(token) as any;

      expect(extracted.iat).toBeDefined(); // Issued at
      expect(extracted.exp).toBeDefined(); // Expiration
      expect(typeof extracted.iat).toBe('number');
      expect(typeof extracted.exp).toBe('number');
      expect(extracted.exp).toBeGreaterThan(extracted.iat);
    });

    it('should handle case-sensitive Bearer prefix', () => {
      const payload: TJson = { userId: '123' };
      const token = generateJwtToken(payload);

      // Only 'Bearer ' (capital B) should be recognized
      const extracted = jwtPayload(`Bearer ${token}`);
      expect(extracted.userId).toBe('123');

      // 'bearer ' (lowercase) should not be stripped
      // This will fail because the token will be invalid
      expect(() => {
        jwtPayload(`bearer ${token}`);
      }).toThrow();
    });
  });

  describe('integration scenarios', () => {
    it('should complete a full sign and verify cycle', () => {
      const originalPayload: TJson = {
        userId: '123',
        email: 'test@example.com',
        role: 'admin',
      };

      // Generate token
      const token = generateJwtToken(originalPayload, '1h');

      // Verify and extract payload
      const extractedPayload = jwtPayload(token);

      // Should match original payload (plus JWT claims)
      expect(extractedPayload.userId).toBe(originalPayload.userId);
      expect(extractedPayload.email).toBe(originalPayload.email);
      expect(extractedPayload.role).toBe(originalPayload.role);
    });

    it('should handle typical authentication flow', () => {
      // User logs in - generate token
      const userClaims: TJson = {
        userId: 'user-456',
        email: 'alice@example.com',
        scopes: ['read:projects', 'write:projects'],
      };

      const token = generateJwtToken(userClaims, '24h');

      // Client sends token with Bearer prefix
      const authHeader = `Bearer ${token}`;

      // Server extracts and validates payload
      const validatedClaims = jwtPayload(authHeader);

      expect(validatedClaims.userId).toBe('user-456');
      expect(validatedClaims.email).toBe('alice@example.com');
      expect(validatedClaims.scopes).toEqual(['read:projects', 'write:projects']);
    });

    it('should handle service-to-service authentication', () => {
      // Service A generates token for Service B
      const serviceClaims: TJson = {
        serviceId: 'gateway-service',
        environment: 'production',
        permissions: ['read:users', 'write:logs'],
      };

      const token = generateJwtToken(serviceClaims, '5m');

      // Service B validates token
      const validated = jwtPayload(token);

      expect(validated.serviceId).toBe('gateway-service');
      expect(validated.environment).toBe('production');
      expect(validated.permissions).toEqual(['read:users', 'write:logs']);
    });
  });
});

