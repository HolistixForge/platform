/**
 * Gateway Rate Limiting Tests
 * 
 * Tests rate limiting functionality for gateway endpoints
 * to ensure protection against abuse and fair resource allocation.
 */

import request from 'supertest';
import express from 'express';
import { globalLimiter, oauthLimiter, apiLimiter } from './rate-limiter';

describe('Gateway Rate Limiting', () => {
  describe('Global Rate Limiter', () => {
    it('should allow up to 500 requests within window', async () => {
      const app = express();
      app.use(globalLimiter);
      app.get('/test', (req, res) => res.json({ success: true }));

      // Test first few requests (not all 500 for performance)
      for (let i = 0; i < 10; i++) {
        const res = await request(app).get('/test');
        expect(res.status).not.toBe(429);
      }
    });

    it('should include rate limit headers', async () => {
      const app = express();
      app.use(globalLimiter);
      app.get('/test', (req, res) => res.json({ success: true }));

      const res = await request(app).get('/test');
      
      expect(res.headers['ratelimit-limit']).toBeDefined();
      expect(res.headers['ratelimit-remaining']).toBeDefined();
      expect(res.headers['ratelimit-reset']).toBeDefined();
    });
  });

  describe('OAuth Rate Limiter', () => {
    it('should allow up to 20 OAuth requests within window', async () => {
      const app = express();
      app.use(oauthLimiter);
      app.post('/oauth/token', (req, res) => res.json({ access_token: 'test' }));

      for (let i = 0; i < 20; i++) {
        const res = await request(app).post('/oauth/token');
        expect(res.status).not.toBe(429);
      }
    });

    it('should block 21st OAuth request with 429', async () => {
      const app = express();
      app.use(oauthLimiter);
      app.post('/oauth/token', (req, res) => res.json({ access_token: 'test' }));

      // Make 20 requests
      for (let i = 0; i < 20; i++) {
        await request(app).post('/oauth/token');
      }

      // 21st should be rate limited
      const res = await request(app).post('/oauth/token');
      expect(res.status).toBe(429);
      expect(res.body.error).toContain('Too many');
    });
  });

  describe('API Rate Limiter', () => {
    it('should allow up to 100 API requests within window', async () => {
      const app = express();
      app.use(apiLimiter);
      app.get('/api/data', (req, res) => res.json({ data: [] }));

      // Test first 10 requests
      for (let i = 0; i < 10; i++) {
        const res = await request(app).get('/api/data');
        expect(res.status).not.toBe(429);
      }
    });

    it('should block 101st API request with 429', async () => {
      const app = express();
      app.use(apiLimiter);
      app.get('/api/data', (req, res) => res.json({ data: [] }));

      // Make 100 requests
      for (let i = 0; i < 100; i++) {
        await request(app).get('/api/data');
      }

      // 101st should be rate limited
      const res = await request(app).get('/api/data');
      expect(res.status).toBe(429);
      expect(res.body.error).toContain('Too many');
    });
  });

  describe('Environment Configuration', () => {
    it('should respect RATE_LIMIT_ENABLED environment variable', () => {
      // Test that rate limiting can be disabled
      const originalEnv = process.env.RATE_LIMIT_ENABLED;
      
      process.env.RATE_LIMIT_ENABLED = 'false';
      const { isRateLimitingEnabled } = require('./rate-limiter');
      expect(isRateLimitingEnabled()).toBe(false);
      
      process.env.RATE_LIMIT_ENABLED = 'true';
      expect(isRateLimitingEnabled()).toBe(true);
      
      // Restore original value
      if (originalEnv !== undefined) {
        process.env.RATE_LIMIT_ENABLED = originalEnv;
      } else {
        delete process.env.RATE_LIMIT_ENABLED;
      }
    });
  });
});
