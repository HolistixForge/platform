// Mock database before imports
jest.mock('../../database/pg', () => ({
  pg: {
    query: jest.fn(),
  },
}));

// Mock bcrypt
jest.mock('bcryptjs', () => ({
  hash: jest.fn().mockResolvedValue('$2b$10$hashedSecretValue'),
}));

// Mock log
jest.mock('@holistix-forge/log', () => ({
  EPriority: {
    Info: 'info',
    Warning: 'warning',
    Error: 'error',
  },
  log: jest.fn(),
}));

// Mock config with test keys
jest.mock('../../config', () => {
  const crypto = require('crypto');
  const { publicKey, privateKey } = crypto.generateKeyPairSync('rsa', {
    modulusLength: 2048,
    publicKeyEncoding: { type: 'spki', format: 'pem' },
    privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
  });
  return {
    CONFIG: {
      JWT_PUBLIC_KEY: publicKey,
      JWT_PRIVATE_KEY: privateKey,
    },
  };
});

import request from 'supertest';
import express, { Express } from 'express';
import jwt from 'jsonwebtoken';
import { setupInternalOAuthClientRoutes } from './oauth-clients';
import { pg } from '../../database/pg';
import { CONFIG } from '../../config';

function makeGatewayToken(overrides: Record<string, any> = {}): string {
  return jwt.sign(
    {
      type: 'gateway_token',
      gateway_id: '20f68e49-1171-4bd4-a1ea-d70731b1fcef',
      scope: 'gateway:20f68e49-1171-4bd4-a1ea-d70731b1fcef:ready',
      ...overrides,
    },
    CONFIG.JWT_PRIVATE_KEY,
    { algorithm: 'RS256', expiresIn: '1h' }
  );
}

describe('Internal OAuth Client Routes', () => {
  let app: Express;
  let GATEWAY_TOKEN: string;

  beforeEach(() => {
    jest.clearAllMocks();
    process.env.DOMAIN = 'apollo.local';

    GATEWAY_TOKEN = makeGatewayToken();

    app = express();
    app.use(express.json());
    const router = express.Router();
    setupInternalOAuthClientRoutes(router);
    app.use('/', router);

    // Error handler
    app.use((err: Error, req: any, res: any, _next: any) => {
      res.status(500).json({ error: err.message });
    });
  });

  afterEach(() => {
    delete process.env.DOMAIN;
  });

  describe('POST /internal/oauth/clients', () => {
    it('should create a client with server-generated credentials', async () => {
      const mockQuery = jest.mocked(pg.query);
      mockQuery.mockResolvedValue(undefined as any);

      const response = await request(app)
        .post('/internal/oauth/clients')
        .set('X-Gateway-Token', GATEWAY_TOKEN)
        .send({
          redirect_uris: [
            'https://uc-abc.org-123.apollo.local/__auth/callback',
          ],
          grants: ['authorization_code', 'refresh_token'],
          label: 'guard:test-container',
        })
        .expect(201);

      expect(response.body.client_id).toBeDefined();
      expect(response.body.client_secret).toBeDefined();
      expect(response.body.client_secret.length).toBe(64); // 32 bytes hex
      expect(response.body.redirect_uris).toEqual([
        'https://uc-abc.org-123.apollo.local/__auth/callback',
      ]);
      expect(response.body.grants).toEqual([
        'authorization_code',
        'refresh_token',
      ]);

      // Verify DB was called with bcrypt hash, not plaintext
      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO oauth_clients'),
        expect.arrayContaining([
          expect.any(String), // client_id (UUID)
          'hashed', // placeholder for legacy column
          '$2b$10$hashedSecretValue', // bcrypt hash
          expect.any(String), // redirect_uris JSON
          expect.any(String), // grants JSON
          300, // default access_token_lifetime
          3600, // default refresh_token_lifetime
          'guard:test-container', // label
          '20f68e49-1171-4bd4-a1ea-d70731b1fcef', // created_by (gateway_id from JWT)
        ])
      );
    });

    it('should reject redirect_uri to external domain', async () => {
      await request(app)
        .post('/internal/oauth/clients')
        .set('X-Gateway-Token', GATEWAY_TOKEN)
        .send({
          redirect_uris: ['https://evil.com/steal'],
          grants: ['authorization_code'],
        })
        .expect(400);
    });

    it('should reject redirect_uri that looks like subdomain but is external', async () => {
      await request(app)
        .post('/internal/oauth/clients')
        .set('X-Gateway-Token', GATEWAY_TOKEN)
        .send({
          redirect_uris: ['https://apollo.local.evil.com/callback'],
          grants: ['authorization_code'],
        })
        .expect(400);
    });

    it('should accept redirect_uri that is exact domain match', async () => {
      const mockQuery = jest.mocked(pg.query);
      mockQuery.mockResolvedValue(undefined as any);

      await request(app)
        .post('/internal/oauth/clients')
        .set('X-Gateway-Token', GATEWAY_TOKEN)
        .send({
          redirect_uris: ['https://apollo.local/callback'],
          grants: ['authorization_code'],
        })
        .expect(201);
    });

    it('should reject without gateway token (401)', async () => {
      await request(app)
        .post('/internal/oauth/clients')
        .send({
          redirect_uris: [
            'https://uc-abc.org-123.apollo.local/__auth/callback',
          ],
          grants: ['authorization_code'],
        })
        .expect(401);
    });

    it('should reject with invalid gateway token (403)', async () => {
      await request(app)
        .post('/internal/oauth/clients')
        .set('X-Gateway-Token', 'wrong-token')
        .send({
          redirect_uris: [
            'https://uc-abc.org-123.apollo.local/__auth/callback',
          ],
          grants: ['authorization_code'],
        })
        .expect(403);
    });

    it('should reject non-gateway JWT token type (403)', async () => {
      const badToken = jwt.sign(
        { type: 'access_token', user: { id: 'test' } },
        CONFIG.JWT_PRIVATE_KEY,
        { algorithm: 'RS256', expiresIn: '1h' }
      );

      await request(app)
        .post('/internal/oauth/clients')
        .set('X-Gateway-Token', badToken)
        .send({
          redirect_uris: [
            'https://uc-abc.org-123.apollo.local/__auth/callback',
          ],
          grants: ['authorization_code'],
        })
        .expect(403);
    });

    it('should reject missing redirect_uris', async () => {
      await request(app)
        .post('/internal/oauth/clients')
        .set('X-Gateway-Token', GATEWAY_TOKEN)
        .send({
          grants: ['authorization_code'],
        })
        .expect(400);
    });

    it('should reject missing grants', async () => {
      await request(app)
        .post('/internal/oauth/clients')
        .set('X-Gateway-Token', GATEWAY_TOKEN)
        .send({
          redirect_uris: [
            'https://uc-abc.org-123.apollo.local/__auth/callback',
          ],
        })
        .expect(400);
    });

    it('should reject empty grants array', async () => {
      const response = await request(app)
        .post('/internal/oauth/clients')
        .set('X-Gateway-Token', GATEWAY_TOKEN)
        .send({
          redirect_uris: [
            'https://uc-abc.org-123.apollo.local/__auth/callback',
          ],
          grants: [],
        })
        .expect(400);

      expect(response.body.error).toContain('grants required');
    });

    it('should reject invalid grant types', async () => {
      const response = await request(app)
        .post('/internal/oauth/clients')
        .set('X-Gateway-Token', GATEWAY_TOKEN)
        .send({
          redirect_uris: [
            'https://uc-abc.org-123.apollo.local/__auth/callback',
          ],
          grants: ['authorization_code', 'invalid_grant'],
        })
        .expect(400);

      expect(response.body.error).toContain('Invalid grant types');
      expect(response.body.error).toContain('invalid_grant');
    });

    it('should reject invalid redirect_uri format', async () => {
      await request(app)
        .post('/internal/oauth/clients')
        .set('X-Gateway-Token', GATEWAY_TOKEN)
        .send({
          redirect_uris: ['not-a-valid-url'],
          grants: ['authorization_code'],
        })
        .expect(400);
    });

    it('should return 500 when database insert fails', async () => {
      const mockQuery = jest.mocked(pg.query);
      mockQuery.mockRejectedValue(new Error('DB connection failed'));

      await request(app)
        .post('/internal/oauth/clients')
        .set('X-Gateway-Token', GATEWAY_TOKEN)
        .send({
          redirect_uris: [
            'https://uc-abc.org-123.apollo.local/__auth/callback',
          ],
          grants: ['authorization_code'],
        })
        .expect(500);
    });

    it('should use custom token lifetimes when provided', async () => {
      const mockQuery = jest.mocked(pg.query);
      mockQuery.mockResolvedValue(undefined as any);

      await request(app)
        .post('/internal/oauth/clients')
        .set('X-Gateway-Token', GATEWAY_TOKEN)
        .send({
          redirect_uris: [
            'https://uc-abc.org-123.apollo.local/__auth/callback',
          ],
          grants: ['authorization_code'],
          access_token_lifetime: 600,
          refresh_token_lifetime: 7200,
        })
        .expect(201);

      expect(mockQuery).toHaveBeenCalledWith(
        expect.any(String),
        expect.arrayContaining([600, 7200])
      );
    });
  });

  describe('DELETE /internal/oauth/clients/:client_id', () => {
    it('should delete a client', async () => {
      const mockQuery = jest.mocked(pg.query);
      mockQuery.mockResolvedValue(undefined as any);

      const response = await request(app)
        .delete('/internal/oauth/clients/test-client-id')
        .set('X-Gateway-Token', GATEWAY_TOKEN)
        .expect(200);

      expect(response.body).toEqual({ deleted: true });
      expect(mockQuery).toHaveBeenCalledWith(
        'DELETE FROM oauth_clients WHERE client_id = $1',
        ['test-client-id']
      );
    });

    it('should reject without gateway token', async () => {
      await request(app)
        .delete('/internal/oauth/clients/test-client-id')
        .expect(401);
    });

    it('should return 500 when database delete fails', async () => {
      const mockQuery = jest.mocked(pg.query);
      mockQuery.mockRejectedValue(new Error('DB connection failed'));

      await request(app)
        .delete('/internal/oauth/clients/test-client-id')
        .set('X-Gateway-Token', GATEWAY_TOKEN)
        .expect(500);
    });
  });
});
