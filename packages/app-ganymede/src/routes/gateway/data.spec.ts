/**
 * Gateway Data Routes - Path Injection Protection Tests
 *
 * Tests for path injection protection in gateway/data.ts
 * Validates that organization IDs are properly validated in getOrgDataPath
 * to prevent path traversal attacks
 */

import request from 'supertest';
import express from 'express';
import { setupGatewayDataRoutes } from './data';

// Mock dependencies
jest.mock('../../database/pg', () => ({
  pg: {
    query: jest.fn(),
  },
}));

jest.mock('@holistix-forge/log', () => ({
  EPriority: {
    Info: 'info',
    Warning: 'warning',
    Error: 'error',
  },
  log: jest.fn(),
  error: jest.fn(),
}));

jest.mock('../../middleware/auth', () => ({
  authenticateJwtOrganization: jest.fn((req: any, res: any, next: any) => {
    req.organization = {
      organization_id: '550e8400-e29b-41d4-a716-446655440000',
      gateway_id: 'gateway-123',
    };
    next();
  }),
  authenticateJwtUser: jest.fn((req: any, res: any, next: any) => {
    req.user = { id: 'user-123' };
    next();
  }),
}));

// Mock file system operations
jest.mock('fs', () => {
  const actualFs = jest.requireActual('fs');
  return {
    ...actualFs,
    promises: {
      mkdir: jest.fn().mockResolvedValue(undefined),
      writeFile: jest.fn().mockResolvedValue(undefined),
      readFile: jest.fn().mockResolvedValue('{"test": "data"}'),
    },
    existsSync: jest.fn().mockReturnValue(true),
  };
});

describe('Gateway Data Routes - Path Injection Protection', () => {
  let app: express.Express;

  beforeEach(() => {
    process.env.ENV_NAME = 'test-env';

    app = express();
    app.use(express.json());

    const router = express.Router();
    setupGatewayDataRoutes(router);
    app.use('/gateway/data', router);

    jest.clearAllMocks();
  });

  afterEach(() => {
    delete process.env.ENV_NAME;
  });

  describe('getOrgDataPath - Valid Organization IDs', () => {
    it('should accept POST /push with valid UUID organization ID', async () => {
      const validData = {
        organization_id: '550e8400-e29b-41d4-a716-446655440000',
        gateway_id: 'gateway-123',
        timestamp: new Date().toISOString(),
        data: {
          test: 'data',
        },
      };

      const res = await request(app).post('/gateway/data/push').send(validData);

      // Should not throw path injection error
      // (may fail for other reasons like DB, but not path validation)
      expect(res.status).not.toBe(400);
    });

    it('should accept POST /pull with valid UUID organization ID', async () => {
      const res = await request(app).get('/gateway/data/pull').query({
        organization_id: '550e8400-e29b-41d4-a716-446655440000',
      });

      // Should not throw path injection error
      expect(res.status).not.toBe(500);
    });

    it('should handle UUID with all lowercase hexadecimal characters', async () => {
      const validData = {
        organization_id: 'abcdef01-2345-6789-abcd-ef0123456789',
        gateway_id: 'gateway-123',
        timestamp: new Date().toISOString(),
        data: {},
      };

      const res = await request(app).post('/gateway/data/push').send(validData);

      expect(res.status).not.toBe(400);
    });
  });

  describe('getOrgDataPath - Path Traversal Protection', () => {
    it('should reject organization ID with path traversal (..) characters', async () => {
      const maliciousData = {
        organization_id: '../../../etc/passwd',
        gateway_id: 'gateway-123',
        timestamp: new Date().toISOString(),
        data: {},
      };

      const res = await request(app)
        .post('/gateway/data/push')
        .send(maliciousData);

      // Should return error (exact status depends on error handling)
      expect(res.status).toBeGreaterThanOrEqual(400);
    });

    it('should reject organization ID with single dot traversal', async () => {
      const maliciousData = {
        organization_id: '../../sensitive-file',
        gateway_id: 'gateway-123',
        timestamp: new Date().toISOString(),
        data: {},
      };

      const res = await request(app)
        .post('/gateway/data/push')
        .send(maliciousData);

      expect(res.status).toBeGreaterThanOrEqual(400);
    });

    it('should reject organization ID with forward slashes', async () => {
      const maliciousData = {
        organization_id: '550e8400/e29b/41d4/a716/446655440000',
        gateway_id: 'gateway-123',
        timestamp: new Date().toISOString(),
        data: {},
      };

      const res = await request(app)
        .post('/gateway/data/push')
        .send(maliciousData);

      expect(res.status).toBeGreaterThanOrEqual(400);
    });

    it('should reject organization ID with backslashes', async () => {
      const maliciousData = {
        organization_id: '550e8400\\e29b\\41d4\\a716\\446655440000',
        gateway_id: 'gateway-123',
        timestamp: new Date().toISOString(),
        data: {},
      };

      const res = await request(app)
        .post('/gateway/data/push')
        .send(maliciousData);

      expect(res.status).toBeGreaterThanOrEqual(400);
    });

    it('should reject absolute path in organization ID', async () => {
      const maliciousData = {
        organization_id: '/etc/passwd',
        gateway_id: 'gateway-123',
        timestamp: new Date().toISOString(),
        data: {},
      };

      const res = await request(app)
        .post('/gateway/data/push')
        .send(maliciousData);

      expect(res.status).toBeGreaterThanOrEqual(400);
    });

    it('should reject organization ID attempting to escape data directory', async () => {
      const maliciousData = {
        organization_id: '../../../../root/.ssh/id_rsa',
        gateway_id: 'gateway-123',
        timestamp: new Date().toISOString(),
        data: {},
      };

      const res = await request(app)
        .post('/gateway/data/push')
        .send(maliciousData);

      expect(res.status).toBeGreaterThanOrEqual(400);
    });

    it('should reject organization ID with null bytes', async () => {
      const maliciousData = {
        organization_id: '550e8400\0e29b-41d4-a716-446655440000',
        gateway_id: 'gateway-123',
        timestamp: new Date().toISOString(),
        data: {},
      };

      const res = await request(app)
        .post('/gateway/data/push')
        .send(maliciousData);

      expect(res.status).toBeGreaterThanOrEqual(400);
    });
  });

  describe('getOrgDataPath - Invalid UUID Formats', () => {
    it('should reject non-UUID organization ID', async () => {
      const invalidData = {
        organization_id: 'not-a-valid-uuid',
        gateway_id: 'gateway-123',
        timestamp: new Date().toISOString(),
        data: {},
      };

      const res = await request(app)
        .post('/gateway/data/push')
        .send(invalidData);

      expect(res.status).toBeGreaterThanOrEqual(400);
    });

    it('should reject organization ID with uppercase letters', async () => {
      const invalidData = {
        organization_id: '550E8400-E29B-41D4-A716-446655440000',
        gateway_id: 'gateway-123',
        timestamp: new Date().toISOString(),
        data: {},
      };

      const res = await request(app)
        .post('/gateway/data/push')
        .send(invalidData);

      expect(res.status).toBeGreaterThanOrEqual(400);
    });

    it('should reject organization ID that is too short', async () => {
      const invalidData = {
        organization_id: '550e8400-e29b-41d4',
        gateway_id: 'gateway-123',
        timestamp: new Date().toISOString(),
        data: {},
      };

      const res = await request(app)
        .post('/gateway/data/push')
        .send(invalidData);

      expect(res.status).toBeGreaterThanOrEqual(400);
    });

    it('should reject organization ID that is too long', async () => {
      const invalidData = {
        organization_id: '550e8400-e29b-41d4-a716-446655440000-extra-chars',
        gateway_id: 'gateway-123',
        timestamp: new Date().toISOString(),
        data: {},
      };

      const res = await request(app)
        .post('/gateway/data/push')
        .send(invalidData);

      expect(res.status).toBeGreaterThanOrEqual(400);
    });

    it('should reject empty organization ID', async () => {
      const invalidData = {
        organization_id: '',
        gateway_id: 'gateway-123',
        timestamp: new Date().toISOString(),
        data: {},
      };

      const res = await request(app)
        .post('/gateway/data/push')
        .send(invalidData);

      expect(res.status).toBeGreaterThanOrEqual(400);
    });

    it('should reject organization ID with special characters', async () => {
      const invalidData = {
        organization_id: '550e8400-e29b-41d4-a716-44665544000!',
        gateway_id: 'gateway-123',
        timestamp: new Date().toISOString(),
        data: {},
      };

      const res = await request(app)
        .post('/gateway/data/push')
        .send(invalidData);

      expect(res.status).toBeGreaterThanOrEqual(400);
    });

    it('should reject organization ID with spaces', async () => {
      const invalidData = {
        organization_id: '550e8400 e29b 41d4 a716 446655440000',
        gateway_id: 'gateway-123',
        timestamp: new Date().toISOString(),
        data: {},
      };

      const res = await request(app)
        .post('/gateway/data/push')
        .send(invalidData);

      expect(res.status).toBeGreaterThanOrEqual(400);
    });
  });

  describe('Edge Cases', () => {
    it('should handle UUID with missing dashes', async () => {
      const invalidData = {
        organization_id: '550e8400e29b41d4a716446655440000',
        gateway_id: 'gateway-123',
        timestamp: new Date().toISOString(),
        data: {},
      };

      const res = await request(app)
        .post('/gateway/data/push')
        .send(invalidData);

      expect(res.status).toBeGreaterThanOrEqual(400);
    });

    it('should handle UUID with wrong dash positions', async () => {
      const invalidData = {
        organization_id: '550e-8400-e29b-41d4-a716446655440000',
        gateway_id: 'gateway-123',
        timestamp: new Date().toISOString(),
        data: {},
      };

      const res = await request(app)
        .post('/gateway/data/push')
        .send(invalidData);

      expect(res.status).toBeGreaterThanOrEqual(400);
    });

    it('should handle URL-encoded path traversal attempts', async () => {
      const maliciousData = {
        organization_id: '..%2F..%2Fetc%2Fpasswd',
        gateway_id: 'gateway-123',
        timestamp: new Date().toISOString(),
        data: {},
      };

      const res = await request(app)
        .post('/gateway/data/push')
        .send(maliciousData);

      expect(res.status).toBeGreaterThanOrEqual(400);
    });

    it('should handle Unicode characters in organization ID', async () => {
      const maliciousData = {
        organization_id: '550e8400-e29b-41d4-a716-44665544000あ',
        gateway_id: 'gateway-123',
        timestamp: new Date().toISOString(),
        data: {},
      };

      const res = await request(app)
        .post('/gateway/data/push')
        .send(maliciousData);

      expect(res.status).toBeGreaterThanOrEqual(400);
    });
  });

  describe('Path Resolution Verification', () => {
    it('should ensure resolved path stays within data directory', async () => {
      // This tests the additional path resolution security check
      const maliciousData = {
        organization_id:
          '550e8400-e29b-41d4-a716-446655440000/../../../etc/passwd',
        gateway_id: 'gateway-123',
        timestamp: new Date().toISOString(),
        data: {},
      };

      const res = await request(app)
        .post('/gateway/data/push')
        .send(maliciousData);

      // Should be rejected by UUID validation first, or path resolution check
      expect(res.status).toBeGreaterThanOrEqual(400);
    });

    it('should handle symlink-like patterns', async () => {
      const maliciousData = {
        organization_id: '550e8400-e29b-41d4-a716-446655440000/../../root',
        gateway_id: 'gateway-123',
        timestamp: new Date().toISOString(),
        data: {},
      };

      const res = await request(app)
        .post('/gateway/data/push')
        .send(maliciousData);

      expect(res.status).toBeGreaterThanOrEqual(400);
    });
  });
});
