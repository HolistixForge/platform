/**
 * Gateway Rate Limiting Tests
 *
 * Simple, focused tests for rate limiting middleware.
 */

import request from 'supertest';
import express from 'express';
import { globalLimiter, oauthLimiter, apiLimiter } from './rate-limiter';

describe('Gateway Rate Limiting', () => {
  describe('API Rate Limiter (max: 100 requests)', () => {
    let app: express.Express;

    beforeAll(() => {
      app = express();
      app.post('/test', apiLimiter, (req, res) => {
        res.json({ success: true });
      });
    });

    it('should allow up to 100 requests', async () => {
      for (let i = 0; i < 100; i++) {
        const res = await request(app).post('/test');
        expect(res.status).toBe(200);
      }
    });

    it('should block 101st request with 429', async () => {
      const res = await request(app).post('/test');
      expect(res.status).toBe(429);
      expect(res.body.error).toContain('Too many requests');
    });

    it('should include rate limit headers', async () => {
      const res = await request(app).post('/test');
      expect(res.headers['ratelimit-limit']).toBeDefined();
      expect(res.headers['ratelimit-remaining']).toBeDefined();
      expect(res.headers['ratelimit-reset']).toBeDefined();
    });
  });

  describe('OAuth Rate Limiter (max: 20 requests)', () => {
    let app: express.Express;

    beforeAll(() => {
      app = express();
      app.post('/oauth/token', oauthLimiter, (req, res) => {
        res.json({ access_token: 'test' });
      });
    });

    it('should allow up to 20 requests', async () => {
      for (let i = 0; i < 20; i++) {
        const res = await request(app).post('/oauth/token');
        expect(res.status).toBe(200);
      }
    });

    it('should block 21st request with 429', async () => {
      const res = await request(app).post('/oauth/token');
      expect(res.status).toBe(429);
      expect(res.body.error).toContain('Too many requests');
    });
  });

  describe('Global Rate Limiter (max: 500 requests)', () => {
    let app: express.Express;

    beforeAll(() => {
      app = express();
      app.use(globalLimiter);
      app.get('/test', (req, res) => res.json({ success: true }));
    });

    it('should include rate limit headers', async () => {
      const res = await request(app).get('/test');
      expect(res.headers['ratelimit-limit']).toBeDefined();
      expect(res.headers['ratelimit-remaining']).toBeDefined();
      expect(res.headers['ratelimit-reset']).toBeDefined();
    });
  });
});
