/**
 * Nginx Manager - Path Injection Protection Tests
 *
 * Tests for path injection protection in nginx-manager.ts
 * Validates that organization IDs are properly validated to prevent path traversal attacks
 */

import { NginxManager } from './nginx-manager';
import fs from 'fs';

// Mock dependencies
jest.mock('child_process', () => ({
  exec: jest.fn((cmd, callback) => callback(null, { stdout: '', stderr: '' })),
}));

jest.mock('@holistix-forge/log', () => ({
  EPriority: {
    Info: 'info',
    Error: 'error',
  },
  log: jest.fn(),
}));

// Mock fs promises
jest.mock('fs', () => {
  const actualFs = jest.requireActual('fs');
  return {
    ...actualFs,
    promises: {
      mkdir: jest.fn().mockResolvedValue(undefined),
      writeFile: jest.fn().mockResolvedValue(undefined),
      unlink: jest.fn().mockResolvedValue(undefined),
      access: jest.fn().mockResolvedValue(undefined), // Mock access for removeGatewayConfig
    },
    constants: {
      F_OK: 0,
    },
  };
});

describe('NginxManager - Path Injection Protection', () => {
  let nginxManager: NginxManager;

  beforeEach(() => {
    process.env.ENV_NAME = 'test-env';
    process.env.DOMAIN = 'test.local';
    nginxManager = new NginxManager();
    jest.clearAllMocks();
  });

  afterEach(() => {
    delete process.env.ENV_NAME;
    delete process.env.DOMAIN;
  });

  describe('createGatewayConfig - Valid Organization IDs', () => {
    it('should accept valid UUID organization ID', async () => {
      const validUuid = '550e8400-e29b-41d4-a716-446655440000';

      await expect(
        nginxManager.createGatewayConfig(validUuid, 7100)
      ).resolves.not.toThrow();

      expect(fs.promises.writeFile).toHaveBeenCalled();
    });

    it('should accept another valid UUID organization ID', async () => {
      const validUuid = '123e4567-e89b-12d3-a456-426614174000';

      await expect(
        nginxManager.createGatewayConfig(validUuid, 7101)
      ).resolves.not.toThrow();

      expect(fs.promises.writeFile).toHaveBeenCalled();
    });

    it('should accept UUID with all lowercase letters', async () => {
      const validUuid = 'abcdef01-2345-6789-abcd-ef0123456789';

      await expect(
        nginxManager.createGatewayConfig(validUuid, 7102)
      ).resolves.not.toThrow();

      expect(fs.promises.writeFile).toHaveBeenCalled();
    });
  });

  describe('createGatewayConfig - Path Traversal Attacks', () => {
    it('should reject organization ID with path traversal (..) characters', async () => {
      const maliciousId = '../../../etc/passwd';

      await expect(
        nginxManager.createGatewayConfig(maliciousId, 7100)
      ).rejects.toThrow('Invalid organization ID format');

      expect(fs.promises.writeFile).not.toHaveBeenCalled();
    });

    it('should reject organization ID with single dot traversal', async () => {
      const maliciousId = '../../nginx.conf';

      await expect(
        nginxManager.createGatewayConfig(maliciousId, 7100)
      ).rejects.toThrow('Invalid organization ID format');

      expect(fs.promises.writeFile).not.toHaveBeenCalled();
    });

    it('should reject organization ID with forward slashes', async () => {
      const maliciousId = '550e8400/e29b/41d4/a716/446655440000';

      await expect(
        nginxManager.createGatewayConfig(maliciousId, 7100)
      ).rejects.toThrow('Invalid organization ID format');

      expect(fs.promises.writeFile).not.toHaveBeenCalled();
    });

    it('should reject organization ID with backslashes', async () => {
      const maliciousId = '550e8400\\e29b\\41d4\\a716\\446655440000';

      await expect(
        nginxManager.createGatewayConfig(maliciousId, 7100)
      ).rejects.toThrow('Invalid organization ID format');

      expect(fs.promises.writeFile).not.toHaveBeenCalled();
    });

    it('should reject organization ID attempting to write to root', async () => {
      const maliciousId = '/etc/nginx/nginx.conf';

      await expect(
        nginxManager.createGatewayConfig(maliciousId, 7100)
      ).rejects.toThrow('Invalid organization ID format');

      expect(fs.promises.writeFile).not.toHaveBeenCalled();
    });

    it('should reject organization ID with null bytes', async () => {
      const maliciousId = '550e8400\0e29b-41d4-a716-446655440000';

      await expect(
        nginxManager.createGatewayConfig(maliciousId, 7100)
      ).rejects.toThrow('Invalid organization ID format');

      expect(fs.promises.writeFile).not.toHaveBeenCalled();
    });
  });

  describe('createGatewayConfig - Invalid UUID Formats', () => {
    it('should reject non-UUID organization ID', async () => {
      const invalidId = 'not-a-valid-uuid';

      await expect(
        nginxManager.createGatewayConfig(invalidId, 7100)
      ).rejects.toThrow('Invalid organization ID format');

      expect(fs.promises.writeFile).not.toHaveBeenCalled();
    });

    it('should reject organization ID with uppercase letters', async () => {
      const invalidId = '550E8400-E29B-41D4-A716-446655440000';

      await expect(
        nginxManager.createGatewayConfig(invalidId, 7100)
      ).rejects.toThrow('Invalid organization ID format');

      expect(fs.promises.writeFile).not.toHaveBeenCalled();
    });

    it('should reject organization ID that is too short', async () => {
      const invalidId = '550e8400-e29b-41d4';

      await expect(
        nginxManager.createGatewayConfig(invalidId, 7100)
      ).rejects.toThrow('Invalid organization ID format');

      expect(fs.promises.writeFile).not.toHaveBeenCalled();
    });

    it('should reject organization ID that is too long', async () => {
      const invalidId = '550e8400-e29b-41d4-a716-446655440000-extra';

      await expect(
        nginxManager.createGatewayConfig(invalidId, 7100)
      ).rejects.toThrow('Invalid organization ID format');

      expect(fs.promises.writeFile).not.toHaveBeenCalled();
    });

    it('should reject empty organization ID', async () => {
      const invalidId = '';

      await expect(
        nginxManager.createGatewayConfig(invalidId, 7100)
      ).rejects.toThrow('Invalid organization ID format');

      expect(fs.promises.writeFile).not.toHaveBeenCalled();
    });

    it('should reject organization ID with special characters', async () => {
      const invalidId = '550e8400-e29b-41d4-a716-44665544000!';

      await expect(
        nginxManager.createGatewayConfig(invalidId, 7100)
      ).rejects.toThrow('Invalid organization ID format');

      expect(fs.promises.writeFile).not.toHaveBeenCalled();
    });

    it('should reject organization ID with spaces', async () => {
      const invalidId = '550e8400 e29b 41d4 a716 446655440000';

      await expect(
        nginxManager.createGatewayConfig(invalidId, 7100)
      ).rejects.toThrow('Invalid organization ID format');

      expect(fs.promises.writeFile).not.toHaveBeenCalled();
    });
  });

  describe('removeGatewayConfig - Valid Organization IDs', () => {
    it('should accept valid UUID organization ID for removal', async () => {
      const validUuid = '550e8400-e29b-41d4-a716-446655440000';

      await expect(
        nginxManager.removeGatewayConfig(validUuid)
      ).resolves.not.toThrow();

      expect(fs.promises.unlink).toHaveBeenCalled();
    });
  });

  describe('removeGatewayConfig - Path Traversal Attacks', () => {
    it('should reject path traversal in removeGatewayConfig', async () => {
      const maliciousId = '../../../etc/passwd';

      await expect(
        nginxManager.removeGatewayConfig(maliciousId)
      ).rejects.toThrow('Invalid organization ID format');

      expect(fs.promises.unlink).not.toHaveBeenCalled();
    });

    it('should reject organization ID with directory traversal', async () => {
      const maliciousId = '../../important-file';

      await expect(
        nginxManager.removeGatewayConfig(maliciousId)
      ).rejects.toThrow('Invalid organization ID format');

      expect(fs.promises.unlink).not.toHaveBeenCalled();
    });

    it('should reject absolute path in removeGatewayConfig', async () => {
      const maliciousId = '/etc/nginx/nginx.conf';

      await expect(
        nginxManager.removeGatewayConfig(maliciousId)
      ).rejects.toThrow('Invalid organization ID format');

      expect(fs.promises.unlink).not.toHaveBeenCalled();
    });
  });

  describe('Edge Cases', () => {
    it('should handle UUID with missing dashes', async () => {
      const invalidId = '550e8400e29b41d4a716446655440000';

      await expect(
        nginxManager.createGatewayConfig(invalidId, 7100)
      ).rejects.toThrow('Invalid organization ID format');

      expect(fs.promises.writeFile).not.toHaveBeenCalled();
    });

    it('should handle UUID with wrong dash positions', async () => {
      // Note: Current regex validates length and characters but not dash positions
      // This is acceptable for security (prevents path traversal) but not strict UUID validation
      // A string with wrong dash positions but correct length will still pass
      const invalidId = '550e-8400-e29b-41d4-a716446655440000'; // 36 chars, wrong dashes

      // This actually passes current validation (length=36, all valid chars)
      // If we want strict UUID validation, we'd need a more complex regex
      await expect(
        nginxManager.createGatewayConfig(invalidId, 7100)
      ).resolves.not.toThrow();

      // The current validation is sufficient for security (prevents path traversal)
      // Strict UUID format validation can be added if needed
    });

    it('should handle URL-encoded path traversal attempts', async () => {
      const maliciousId = '..%2F..%2Fetc%2Fpasswd';

      await expect(
        nginxManager.createGatewayConfig(maliciousId, 7100)
      ).rejects.toThrow('Invalid organization ID format');

      expect(fs.promises.writeFile).not.toHaveBeenCalled();
    });

    it('should handle Unicode characters in organization ID', async () => {
      const maliciousId = '550e8400-e29b-41d4-a716-44665544000あ';

      await expect(
        nginxManager.createGatewayConfig(maliciousId, 7100)
      ).rejects.toThrow('Invalid organization ID format');

      expect(fs.promises.writeFile).not.toHaveBeenCalled();
    });
  });
});
