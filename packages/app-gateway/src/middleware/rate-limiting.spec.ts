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

    beforeEach(() => {
      // Create fresh app for each test to avoid rate limiter state pollution
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
    }, 10000); // Increase timeout for 100 requests

    it('should block request after limit with 429', async () => {
      // First exhaust the limit
      for (let i = 0; i < 100; i++) {
        await request(app).post('/test');
      }
      
      // Then verify the next request is blocked
      const res = await request(app).post('/test');
      expect(res.status).toBe(429);
      expect(res.body.error).toContain('Too many requests');
    }, 10000);

    it('should include rate limit headers', async () => {
      const res = await request(app).post('/test');
      expect(res.headers['ratelimit-limit']).toBeDefined();
      expect(res.headers['ratelimit-remaining']).toBeDefined();
      expect(res.headers['ratelimit-reset']).toBeDefined();
    });
  });

  describe('OAuth Rate Limiter (max: 20 requests)', () => {
    let app: express.Express;

    beforeEach(() => {
      // Create fresh app for each test
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
    }, 5000);

    it('should block request after limit with 429', async () => {
      // First exhaust the limit
      for (let i = 0; i < 20; i++) {
        await request(app).post('/oauth/token');
      }
      
      // Then verify the next request is blocked
      const res = await request(app).post('/oauth/token');
      expect(res.status).toBe(429);
      expect(res.body.error).toContain('Too many requests');
    }, 5000);
  });

  describe('Global Rate Limiter (max: 500 requests)', () => {
    let app: express.Express;

    beforeEach(() => {
      // Create fresh app for each test
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
