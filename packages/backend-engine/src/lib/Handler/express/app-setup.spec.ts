/**
 * CSRF Protection Middleware Tests
 *
 * Tests for the CSRF (Cross-Site Request Forgery) protection middleware
 * implemented in app-setup.ts
 */

import request from 'supertest';
import express from 'express';
import { setupBasicExpressApp } from './app-setup';

describe('CSRF Protection Middleware', () => {
  let app: express.Express;

  beforeEach(() => {
    // Set up allowed origins for testing
    process.env.ALLOWED_ORIGINS = JSON.stringify([
      'http://localhost:3000',
      'https://app.example.com',
    ]);

    // Create test app with CSRF middleware
    app = express();
    setupBasicExpressApp(app);

    // Add test routes
    app.post('/test/post', (req, res) => {
      res.json({ success: true });
    });

    app.get('/test/get', (req, res) => {
      res.json({ success: true });
    });

    app.delete('/test/delete', (req, res) => {
      res.json({ success: true });
    });

    app.patch('/test/patch', (req, res) => {
      res.json({ success: true });
    });

    app.get('/health', (req, res) => {
      res.json({ status: 'ok' });
    });

    app.get('/ping', (req, res) => {
      res.json({ pong: true });
    });
  });

  afterEach(() => {
    delete process.env.ALLOWED_ORIGINS;
  });

  describe('Safe HTTP Methods (GET, HEAD, OPTIONS)', () => {
    it('should allow GET requests without CSRF check', async () => {
      const res = await request(app).get('/test/get');

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });

    it('should allow HEAD requests without CSRF check', async () => {
      const res = await request(app).head('/test/get');

      expect(res.status).toBe(200);
    });

    it('should allow OPTIONS requests without CSRF check', async () => {
      const res = await request(app).options('/test/post');

      expect(res.status).toBe(200);
    });
  });

  describe('JWT Bearer Token Authentication', () => {
    it('should allow POST with valid JWT Bearer token', async () => {
      const res = await request(app)
        .post('/test/post')
        .set('Authorization', 'Bearer valid-jwt-token-here');

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });

    it('should allow DELETE with valid JWT Bearer token', async () => {
      const res = await request(app)
        .delete('/test/delete')
        .set('Authorization', 'Bearer valid-jwt-token-here');

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });

    it('should allow PATCH with valid JWT Bearer token', async () => {
      const res = await request(app)
        .patch('/test/patch')
        .set('Authorization', 'Bearer valid-jwt-token-here');

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });

    it('should reject POST with "bearer" (lowercase) prefix', async () => {
      const res = await request(app)
        .post('/test/post')
        .set('Authorization', 'bearer lowercase-should-not-work');

      expect(res.status).toBe(403);
      expect(res.body.error).toBe('CSRF validation failed');
    });

    it('should reject POST with Authorization header but no Bearer prefix', async () => {
      const res = await request(app)
        .post('/test/post')
        .set('Authorization', 'Basic dXNlcjpwYXNz');

      expect(res.status).toBe(403);
      expect(res.body.error).toBe('CSRF validation failed');
    });
  });

  describe('Health Check Endpoints', () => {
    it('should allow POST to /health without CSRF check', async () => {
      const res = await request(app).post('/health');

      expect(res.status).toBe(404); // Route doesn't exist as POST, but CSRF didn't block it
    });

    it('should allow POST to /ping without CSRF check', async () => {
      const res = await request(app).post('/ping');

      expect(res.status).toBe(404); // Route doesn't exist as POST, but CSRF didn't block it
    });

    it('should allow GET to /health', async () => {
      const res = await request(app).get('/health');

      expect(res.status).toBe(200);
      expect(res.body.status).toBe('ok');
    });
  });

  describe('Origin Header Validation', () => {
    it('should allow POST with valid Origin header', async () => {
      const res = await request(app)
        .post('/test/post')
        .set('Origin', 'http://localhost:3000');

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });

    it('should allow POST with valid Origin header (https)', async () => {
      const res = await request(app)
        .post('/test/post')
        .set('Origin', 'https://app.example.com');

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });

    it('should allow POST with Origin that starts with allowed origin', async () => {
      const res = await request(app)
        .post('/test/post')
        .set('Origin', 'http://localhost:3000/some/path');

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });

    it('should reject POST with disallowed Origin header', async () => {
      const res = await request(app)
        .post('/test/post')
        .set('Origin', 'https://evil.com');

      expect(res.status).toBe(403);
      expect(res.body.error).toBe('CSRF validation failed');
    });

    it('should reject POST with Origin from malicious subdomain', async () => {
      const res = await request(app)
        .post('/test/post')
        .set('Origin', 'https://evil.example.com');

      expect(res.status).toBe(403);
      expect(res.body.error).toBe('CSRF validation failed');
    });
  });

  describe('Referer Header Validation', () => {
    it('should allow POST with valid Referer header', async () => {
      const res = await request(app)
        .post('/test/post')
        .set('Referer', 'http://localhost:3000/dashboard');

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });

    it('should allow POST with valid Referer header (https)', async () => {
      const res = await request(app)
        .post('/test/post')
        .set('Referer', 'https://app.example.com/page');

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });

    it('should reject POST with disallowed Referer header', async () => {
      const res = await request(app)
        .post('/test/post')
        .set('Referer', 'https://malicious-site.com/attack');

      expect(res.status).toBe(403);
      expect(res.body.error).toBe('CSRF validation failed');
    });
  });

  describe('CSRF Attack Prevention', () => {
    it('should reject POST without JWT, Origin, or Referer (CSRF attack)', async () => {
      const res = await request(app).post('/test/post');

      expect(res.status).toBe(403);
      expect(res.body.error).toBe('CSRF validation failed');
    });

    it('should reject DELETE without JWT, Origin, or Referer', async () => {
      const res = await request(app).delete('/test/delete');

      expect(res.status).toBe(403);
      expect(res.body.error).toBe('CSRF validation failed');
    });

    it('should reject PATCH without JWT, Origin, or Referer', async () => {
      const res = await request(app).patch('/test/patch');

      expect(res.status).toBe(403);
      expect(res.body.error).toBe('CSRF validation failed');
    });

    it('should reject POST with empty Origin header', async () => {
      const res = await request(app).post('/test/post').set('Origin', '');

      expect(res.status).toBe(403);
      expect(res.body.error).toBe('CSRF validation failed');
    });
  });

  describe('Origin Header Takes Precedence', () => {
    it('should use Origin header when both Origin and Referer are present', async () => {
      const res = await request(app)
        .post('/test/post')
        .set('Origin', 'http://localhost:3000')
        .set('Referer', 'https://evil.com/attack');

      // Should succeed because Origin is valid (Referer is ignored when Origin is present)
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });

    it('should fall back to Referer when Origin is not present', async () => {
      const res = await request(app)
        .post('/test/post')
        .set('Referer', 'http://localhost:3000/page');

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty ALLOWED_ORIGINS environment variable', async () => {
      process.env.ALLOWED_ORIGINS = '[]';

      const newApp = express();
      setupBasicExpressApp(newApp);
      newApp.post('/test/post', (req, res) => {
        res.json({ success: true });
      });

      const res = await request(newApp)
        .post('/test/post')
        .set('Origin', 'http://localhost:3000');

      // Should reject because no origins are allowed
      expect(res.status).toBe(403);
      expect(res.body.error).toBe('CSRF validation failed');
    });

    it('should handle missing ALLOWED_ORIGINS environment variable', async () => {
      delete process.env.ALLOWED_ORIGINS;

      const newApp = express();
      setupBasicExpressApp(newApp);
      newApp.post('/test/post', (req, res) => {
        res.json({ success: true });
      });

      const res = await request(newApp).post('/test/post');

      // Should reject because no origins are allowed
      expect(res.status).toBe(403);
      expect(res.body.error).toBe('CSRF validation failed');
    });

    it('should handle malformed ALLOWED_ORIGINS JSON', async () => {
      process.env.ALLOWED_ORIGINS = 'not-valid-json';

      const newApp = express();
      setupBasicExpressApp(newApp);
      newApp.post('/test/post', (req, res) => {
        res.json({ success: true });
      });

      const res = await request(newApp).post('/test/post');

      // Should result in an error (either 403 from CSRF or 500 from JSON parse error)
      expect(res.status).toBeGreaterThanOrEqual(400);
    });
  });

  describe('Multiple State-Changing Methods', () => {
    it('should protect PUT requests', async () => {
      app.put('/test/put', (req, res) => {
        res.json({ success: true });
      });

      // Without CSRF protection
      const res = await request(app).put('/test/put');
      expect(res.status).toBe(403);

      // With JWT
      const resWithJwt = await request(app)
        .put('/test/put')
        .set('Authorization', 'Bearer token');
      expect(resWithJwt.status).toBe(200);
    });

    it('should protect custom HTTP methods', async () => {
      // Custom method - should be protected
      const res = await request(app)
        .post('/test/post')
        .set('X-HTTP-Method-Override', 'DELETE');

      // Base POST is protected
      expect(res.status).toBe(403);
    });
  });
});
