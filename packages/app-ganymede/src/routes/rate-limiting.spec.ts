/**
 * Rate Limiting Tests
 *
 * Simple, focused tests for rate limiting functionality.
 * Uses dedicated test routes with no business logic or authentication complexity.
 */

import request from 'supertest';
import { Express, Router, RequestHandler } from 'express';
import { createApp } from '../app';
import { respond } from '@holistix-forge/backend-engine';

describe('Rate Limiting', () => {
  let app: Express;

  beforeAll(() => {
    // Create app with test routes
    app = createApp({
      skipSession: true,
      skipValidation: true,
      setupAdditionalRoutes: (
        router: Router,
        rateLimiters: {
          auth?: RequestHandler;
          oauth?: RequestHandler;
          sensitive?: RequestHandler;
          api?: RequestHandler;
        }
      ) => {
        // Test route for AUTH_STRICT limiter (5 requests per window)
        router.post(
          '/test-rate-limit/auth',
          ...(rateLimiters.auth ? [rateLimiters.auth] : []),
          (req, res) => {
            respond(req, res, {
              type: 'json',
              json: { message: 'Auth rate limit test - success' },
              status: 200,
            });
          }
        );

        // Test route for OAUTH limiter (20 requests per window)
        router.post(
          '/test-rate-limit/oauth',
          ...(rateLimiters.oauth ? [rateLimiters.oauth] : []),
          (req, res) => {
            respond(req, res, {
              type: 'json',
              json: { message: 'OAuth rate limit test - success' },
              status: 200,
            });
          }
        );

        // Test route for SENSITIVE limiter (30 requests per window)
        router.post(
          '/test-rate-limit/sensitive',
          ...(rateLimiters.sensitive ? [rateLimiters.sensitive] : []),
          (req, res) => {
            respond(req, res, {
              type: 'json',
              json: { message: 'Sensitive rate limit test - success' },
              status: 200,
            });
          }
        );

        // Test route for API limiter (100 requests per window)
        router.post(
          '/test-rate-limit/api',
          ...(rateLimiters.api ? [rateLimiters.api] : []),
          (req, res) => {
            respond(req, res, {
              type: 'json',
              json: { message: 'API rate limit test - success' },
              status: 200,
            });
          }
        );

        // Test route with NO rate limiter (control test)
        router.post('/test-rate-limit/none', (req, res) => {
          respond(req, res, {
            type: 'json',
            json: { message: 'No rate limit - success' },
            status: 200,
          });
        });
      },
    });
  });

  describe('AUTH_STRICT Rate Limiter (max: 5 requests)', () => {
    it('should include rate limit headers in responses', async () => {
      const res = await request(app).post('/test-rate-limit/auth').send({});

      // Should have standard rate limit headers
      expect(res.headers['ratelimit-limit']).toBeDefined();
      expect(res.headers['ratelimit-remaining']).toBeDefined();
      expect(res.headers['ratelimit-reset']).toBeDefined();
    });

    it('should allow unlimited successful requests (skipSuccessfulRequests: true)', async () => {
      // AUTH_STRICT has skipSuccessfulRequests: true
      // This means successful (200) requests don't count toward the limit
      // So we can make many successful requests without being rate limited
      for (let i = 0; i < 10; i++) {
        const res = await request(app).post('/test-rate-limit/auth').send({});

        expect(res.status).toBe(200);
        expect(res.body.message).toBe('Auth rate limit test - success');
      }
    });
  });

  describe('OAUTH Rate Limiter (max: 20 requests)', () => {
    it('should allow up to 20 requests', async () => {
      // Make 20 requests - all should succeed
      for (let i = 0; i < 20; i++) {
        const res = await request(app).post('/test-rate-limit/oauth').send({});

        expect(res.status).toBe(200);
      }
    });

    it('should block 21st request with 429', async () => {
      // 21st request should be rate limited
      const res = await request(app).post('/test-rate-limit/oauth').send({});

      expect(res.status).toBe(429);
      expect(res.body.error).toContain('Too many requests');
    });
  });

  describe('SENSITIVE Rate Limiter (max: 30 requests)', () => {
    it('should allow up to 30 requests', async () => {
      // Make 30 requests - all should succeed
      for (let i = 0; i < 30; i++) {
        const res = await request(app)
          .post('/test-rate-limit/sensitive')
          .send({});

        expect(res.status).toBe(200);
      }
    });

    it('should block 31st request with 429', async () => {
      // 31st request should be rate limited
      const res = await request(app)
        .post('/test-rate-limit/sensitive')
        .send({});

      expect(res.status).toBe(429);
      expect(res.body.error).toContain('Too many requests');
    });
  });

  describe('API Rate Limiter (max: 100 requests)', () => {
    it('should allow up to 100 requests', async () => {
      // Make 100 requests - all should succeed
      for (let i = 0; i < 100; i++) {
        const res = await request(app).post('/test-rate-limit/api').send({});

        expect(res.status).toBe(200);
      }
    });

    it('should block 101st request with 429', async () => {
      // 101st request should be rate limited
      const res = await request(app).post('/test-rate-limit/api').send({});

      expect(res.status).toBe(429);
      expect(res.body.error).toContain('Too many requests');
    });
  });

  describe('No Rate Limiter (control test)', () => {
    it('should allow unlimited requests', async () => {
      // Make many requests - all should succeed
      for (let i = 0; i < 150; i++) {
        const res = await request(app).post('/test-rate-limit/none').send({});

        expect(res.status).toBe(200);
      }
    });
  });
});
