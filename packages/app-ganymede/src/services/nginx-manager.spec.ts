/**
 * Nginx Manager - Path Injection Protection Tests
 *
 * Tests for path injection protection in nginx-manager.ts
 * Validates that organization IDs are properly validated to prevent path traversal attacks
 */

import { NginxManager } from './nginx-manager';
import fs from 'fs';
import { exec } from 'child_process';

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
        nginxManager.createGatewayConfig(validUuid, '172.17.0.1:7100')
      ).resolves.not.toThrow();

      expect(fs.promises.writeFile).toHaveBeenCalled();
    });

    it('should accept another valid UUID organization ID', async () => {
      const validUuid = '123e4567-e89b-12d3-a456-426614174000';

      await expect(
        nginxManager.createGatewayConfig(validUuid, '172.17.0.1:7101')
      ).resolves.not.toThrow();

      expect(fs.promises.writeFile).toHaveBeenCalled();
    });

    it('should accept UUID with all lowercase letters', async () => {
      const validUuid = 'abcdef01-2345-6789-abcd-ef0123456789';

      await expect(
        nginxManager.createGatewayConfig(validUuid, '172.17.0.1:7102')
      ).resolves.not.toThrow();

      expect(fs.promises.writeFile).toHaveBeenCalled();
    });
  });

  describe('createGatewayConfig - server_name regex escaping', () => {
    const validUuid = '550e8400-e29b-41d4-a716-446655440000';

    const writtenConfig = async (): Promise<string> => {
      await nginxManager.createGatewayConfig(validUuid, '172.17.0.1:7100');
      const calls = (fs.promises.writeFile as jest.Mock).mock.calls;
      return calls[calls.length - 1][1] as string;
    };

    it('escapes domain dots with a SINGLE backslash (not double)', async () => {
      const config = await writtenConfig();
      // DOMAIN is 'test.local' (set in beforeEach)
      expect(config).toContain(
        `server_name ~^(.+\\.)?org-${validUuid}\\.test\\.local$;`
      );
      // Regression guard: a doubled escape (`test\\.local`) never matches the
      // real hostname and routes org-* traffic to the default server.
      expect(config).not.toContain('test\\\\.local');
    });

    it('produces a server_name regex that matches org and nested subdomains', async () => {
      const config = await writtenConfig();
      const match = config.match(/server_name\s+~\^(.+?)\$;/);
      expect(match).not.toBeNull();
      const re = new RegExp('^' + (match as RegExpMatchArray)[1] + '$');
      expect(re.test(`org-${validUuid}.test.local`)).toBe(true);
      expect(re.test(`uc-1.org-${validUuid}.test.local`)).toBe(true);
      expect(re.test(`svc.uc-1.org-${validUuid}.test.local`)).toBe(true);
      // must NOT match a different org
      expect(re.test('org-other.test.local')).toBe(false);
    });
  });

  describe('createGatewayConfig - Path Traversal Attacks', () => {
    it('should reject organization ID with path traversal (..) characters', async () => {
      const maliciousId = '../../../etc/passwd';

      await expect(
        nginxManager.createGatewayConfig(maliciousId, '172.17.0.1:7100')
      ).rejects.toThrow('Invalid organization ID format');

      expect(fs.promises.writeFile).not.toHaveBeenCalled();
    });

    it('should reject organization ID with single dot traversal', async () => {
      const maliciousId = '../../nginx.conf';

      await expect(
        nginxManager.createGatewayConfig(maliciousId, '172.17.0.1:7100')
      ).rejects.toThrow('Invalid organization ID format');

      expect(fs.promises.writeFile).not.toHaveBeenCalled();
    });

    it('should reject organization ID with forward slashes', async () => {
      const maliciousId = '550e8400/e29b/41d4/a716/446655440000';

      await expect(
        nginxManager.createGatewayConfig(maliciousId, '172.17.0.1:7100')
      ).rejects.toThrow('Invalid organization ID format');

      expect(fs.promises.writeFile).not.toHaveBeenCalled();
    });

    it('should reject organization ID with backslashes', async () => {
      const maliciousId = '550e8400\\e29b\\41d4\\a716\\446655440000';

      await expect(
        nginxManager.createGatewayConfig(maliciousId, '172.17.0.1:7100')
      ).rejects.toThrow('Invalid organization ID format');

      expect(fs.promises.writeFile).not.toHaveBeenCalled();
    });

    it('should reject organization ID attempting to write to root', async () => {
      const maliciousId = '/etc/nginx/nginx.conf';

      await expect(
        nginxManager.createGatewayConfig(maliciousId, '172.17.0.1:7100')
      ).rejects.toThrow('Invalid organization ID format');

      expect(fs.promises.writeFile).not.toHaveBeenCalled();
    });

    it('should reject organization ID with null bytes', async () => {
      const maliciousId = '550e8400\0e29b-41d4-a716-446655440000';

      await expect(
        nginxManager.createGatewayConfig(maliciousId, '172.17.0.1:7100')
      ).rejects.toThrow('Invalid organization ID format');

      expect(fs.promises.writeFile).not.toHaveBeenCalled();
    });
  });

  describe('createGatewayConfig - Invalid UUID Formats', () => {
    it('should reject non-UUID organization ID', async () => {
      const invalidId = 'not-a-valid-uuid';

      await expect(
        nginxManager.createGatewayConfig(invalidId, '172.17.0.1:7100')
      ).rejects.toThrow('Invalid organization ID format');

      expect(fs.promises.writeFile).not.toHaveBeenCalled();
    });

    it('should reject organization ID with uppercase letters', async () => {
      const invalidId = '550E8400-E29B-41D4-A716-446655440000';

      await expect(
        nginxManager.createGatewayConfig(invalidId, '172.17.0.1:7100')
      ).rejects.toThrow('Invalid organization ID format');

      expect(fs.promises.writeFile).not.toHaveBeenCalled();
    });

    it('should reject organization ID that is too short', async () => {
      const invalidId = '550e8400-e29b-41d4';

      await expect(
        nginxManager.createGatewayConfig(invalidId, '172.17.0.1:7100')
      ).rejects.toThrow('Invalid organization ID format');

      expect(fs.promises.writeFile).not.toHaveBeenCalled();
    });

    it('should reject organization ID that is too long', async () => {
      const invalidId = '550e8400-e29b-41d4-a716-446655440000-extra';

      await expect(
        nginxManager.createGatewayConfig(invalidId, '172.17.0.1:7100')
      ).rejects.toThrow('Invalid organization ID format');

      expect(fs.promises.writeFile).not.toHaveBeenCalled();
    });

    it('should reject empty organization ID', async () => {
      const invalidId = '';

      await expect(
        nginxManager.createGatewayConfig(invalidId, '172.17.0.1:7100')
      ).rejects.toThrow('Invalid organization ID format');

      expect(fs.promises.writeFile).not.toHaveBeenCalled();
    });

    it('should reject organization ID with special characters', async () => {
      const invalidId = '550e8400-e29b-41d4-a716-44665544000!';

      await expect(
        nginxManager.createGatewayConfig(invalidId, '172.17.0.1:7100')
      ).rejects.toThrow('Invalid organization ID format');

      expect(fs.promises.writeFile).not.toHaveBeenCalled();
    });

    it('should reject organization ID with spaces', async () => {
      const invalidId = '550e8400 e29b 41d4 a716 446655440000';

      await expect(
        nginxManager.createGatewayConfig(invalidId, '172.17.0.1:7100')
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
        nginxManager.createGatewayConfig(invalidId, '172.17.0.1:7100')
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
        nginxManager.createGatewayConfig(invalidId, '172.17.0.1:7100')
      ).resolves.not.toThrow();

      // The current validation is sufficient for security (prevents path traversal)
      // Strict UUID format validation can be added if needed
    });

    it('should handle URL-encoded path traversal attempts', async () => {
      const maliciousId = '..%2F..%2Fetc%2Fpasswd';

      await expect(
        nginxManager.createGatewayConfig(maliciousId, '172.17.0.1:7100')
      ).rejects.toThrow('Invalid organization ID format');

      expect(fs.promises.writeFile).not.toHaveBeenCalled();
    });

    it('should handle Unicode characters in organization ID', async () => {
      const maliciousId = '550e8400-e29b-41d4-a716-44665544000あ';

      await expect(
        nginxManager.createGatewayConfig(maliciousId, '172.17.0.1:7100')
      ).rejects.toThrow('Invalid organization ID format');

      expect(fs.promises.writeFile).not.toHaveBeenCalled();
    });
  });
});

/**
 * Where nginx is, and how it is told to reload.
 *
 * These are overridable so the same class can run on macOS, where nginx is
 * Homebrew's on 8443 and Ganymede is in a container that cannot signal it. The
 * point of the first block is the *defaults*: a Linux environment sets none of
 * these, and must keep writing exactly what it wrote before.
 */
describe('NginxManager - placement', () => {
  const ORG = '550e8400-e29b-41d4-a716-446655440000';
  const OVERRIDES = [
    'NGINX_GATEWAYS_DIR',
    'NGINX_SSL_CERT',
    'NGINX_SSL_KEY',
    'NGINX_LOGS_DIR',
    'NGINX_LISTEN_PORT',
    'NGINX_TEST_COMMAND',
    'NGINX_RELOAD_COMMAND',
  ];

  const written = () =>
    (fs.promises.writeFile as jest.Mock).mock.calls[0] as [string, string];

  beforeEach(() => {
    process.env.ENV_NAME = 'test-env';
    process.env.DOMAIN = 'test.local';
    OVERRIDES.forEach((name) => delete process.env[name]);
    jest.clearAllMocks();
  });

  afterEach(() => {
    delete process.env.ENV_NAME;
    delete process.env.DOMAIN;
    OVERRIDES.forEach((name) => delete process.env[name]);
  });

  it('writes where it always has when nothing is set', async () => {
    await new NginxManager().createGatewayConfig(ORG, '172.17.0.1:7100');

    const [path, body] = written();
    expect(path).toBe(
      `/root/.local-dev/test-env/nginx-gateways.d/org-${ORG}.conf`
    );
    expect(body).toContain('listen 443 ssl;');
    expect(body).toContain(
      'ssl_certificate /root/.local-dev/test-env/ssl-cert.pem;'
    );
    expect(body).toContain(
      'ssl_certificate_key /root/.local-dev/test-env/ssl-key.pem;'
    );
    expect(body).toContain('/root/.local-dev/test-env/logs/gateway-');
  });

  it('reloads the way it always has when nothing is set', async () => {
    await new NginxManager().reloadNginx();

    const commands = (exec as unknown as jest.Mock).mock.calls.map(
      (call) => call[0]
    );
    expect(commands).toEqual(['sudo nginx -t 2>&1', 'sudo nginx -s reload']);
  });

  it('follows every override into the generated server block', async () => {
    process.env.NGINX_GATEWAYS_DIR = '/Users/dev/.holistix-macos/gw.d';
    process.env.NGINX_SSL_CERT = '/Users/dev/.holistix-macos/certs/d.pem';
    process.env.NGINX_SSL_KEY = '/Users/dev/.holistix-macos/certs/d-key.pem';
    process.env.NGINX_LOGS_DIR = '/Users/dev/.holistix-macos/logs';
    process.env.NGINX_LISTEN_PORT = '8443';

    await new NginxManager().createGatewayConfig(ORG, '127.0.0.1:7100');

    const [path, body] = written();
    expect(path).toBe(`/Users/dev/.holistix-macos/gw.d/org-${ORG}.conf`);
    expect(body).toContain('listen 8443 ssl;');
    expect(body).toContain(
      'ssl_certificate /Users/dev/.holistix-macos/certs/d.pem;'
    );
    expect(body).toContain('/Users/dev/.holistix-macos/logs/gateway-');
    // The address is still whatever the database holds, not a default.
    expect(body).toContain('server 127.0.0.1:7100;');
    // Nothing from the Linux layout leaked through.
    expect(body).not.toContain('/root/.local-dev');
  });

  it('keeps the port out of server_name when DOMAIN carries one', async () => {
    // DOMAIN has to carry the port wherever nginx does not listen on 443:
    // every URL Ganymede builds from it is a link somebody follows, including
    // the one it follows itself to health-check a gateway. `server_name` is
    // the one place it must not appear — nginx matches it against the Host
    // header with the port already removed, so a port here yields a regex
    // that matches nothing and every org request lands on the default server.
    process.env.DOMAIN = 'apollo.test:8443';
    process.env.NGINX_LISTEN_PORT = '8443';

    await new NginxManager().createGatewayConfig(ORG, '192.168.65.1:7200');

    const [, body] = written();
    expect(body).toContain(
      `server_name ~^(.+\\.)?org-${ORG}\\.apollo\\.test$;`
    );
    expect(body).not.toContain('apollo\\.test:8443');
    // The listen port is a port and stays one.
    expect(body).toContain('listen 8443 ssl;');
  });

  it('runs the configured reload instead of signalling nginx directly', async () => {
    process.env.NGINX_TEST_COMMAND = 'true';
    process.env.NGINX_RELOAD_COMMAND = 'touch /shared/gw.d/.reload';

    await new NginxManager().reloadNginx();

    const commands = (exec as unknown as jest.Mock).mock.calls.map(
      (call) => call[0]
    );
    expect(commands).toEqual(['true', 'touch /shared/gw.d/.reload']);
  });
});
