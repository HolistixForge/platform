/**
 * Rate Limiting Tests
 * 
 * Tests rate limiting functionality for authentication endpoints
 * to ensure protection against brute-force attacks and abuse.
 */

import request from 'supertest';
import { Express } from 'express';
import { createApp } from '../../app';

describe('Rate Limiting', () => {
  let app: Express;

  beforeEach(() => {
    // Create app WITH rate limiting (do not skip)
    app = createApp({ skipSession: true });
  });

  describe('POST /login - Authentication Rate Limiting', () => {
    it('should allow up to 5 login attempts within window', async () => {
      // Make 5 requests - all should succeed (not be rate limited)
      for (let i = 0; i < 5; i++) {
        const res = await request(app)
          .post('/login')
          .send({ email: 'test@test.com', password: 'wrongpassword' });
        
        // Should not be rate limited (429)
        // Will fail authentication (500/401) but not be rate limited
        expect(res.status).not.toBe(429);
      }
    });

    it('should block 6th login attempt with 429 status', async () => {
      // Make 5 requests first
      for (let i = 0; i < 5; i++) {
        await request(app)
          .post('/login')
          .send({ email: 'test@test.com', password: 'wrongpassword' });
      }
      
      // 6th request should be rate limited
      const res = await request(app)
        .post('/login')
        .send({ email: 'test@test.com', password: 'wrongpassword' });
      
      expect(res.status).toBe(429);
      expect(res.body.error).toContain('Too many');
    });

    it('should include rate limit headers in response', async () => {
      const res = await request(app)
        .post('/login')
        .send({ email: 'test@test.com', password: 'wrongpassword' });
      
      // Check for standard rate limit headers
      expect(res.headers['ratelimit-limit']).toBeDefined();
      expect(res.headers['ratelimit-remaining']).toBeDefined();
      expect(res.headers['ratelimit-reset']).toBeDefined();
    });
  });

  describe('POST /signup - Signup Rate Limiting', () => {
    it('should allow up to 5 signup attempts within window', async () => {
      for (let i = 0; i < 5; i++) {
        const res = await request(app)
          .post('/signup')
          .send({
            email: `test${i}@test.com`,
            password: 'password123',
            username: `user${i}`,
            firstname: 'Test',
            lastname: 'User',
          });
        
        // Should not be rate limited
        expect(res.status).not.toBe(429);
      }
    });

    it('should block 6th signup attempt with 429 status', async () => {
      // Make 5 requests first
      for (let i = 0; i < 5; i++) {
        await request(app)
          .post('/signup')
          .send({
            email: `test${i}@test.com`,
            password: 'password123',
            username: `user${i}`,
            firstname: 'Test',
            lastname: 'User',
          });
      }
      
      // 6th request should be rate limited
      const res = await request(app)
        .post('/signup')
        .send({
          email: 'test6@test.com',
          password: 'password123',
          username: 'user6',
          firstname: 'Test',
          lastname: 'User',
        });
      
      expect(res.status).toBe(429);
      expect(res.body.error).toContain('Too many');
    });
  });

  describe('POST /totp/login - TOTP Rate Limiting', () => {
    it('should allow up to 5 TOTP attempts within window', async () => {
      for (let i = 0; i < 5; i++) {
        const res = await request(app)
          .post('/totp/login')
          .send({ token: '123456' });
        
        // Should not be rate limited
        expect(res.status).not.toBe(429);
      }
    });

    it('should block 6th TOTP attempt with 429 status', async () => {
      // Make 5 requests first
      for (let i = 0; i < 5; i++) {
        await request(app)
          .post('/totp/login')
          .send({ token: '123456' });
      }
      
      // 6th request should be rate limited
      const res = await request(app)
        .post('/totp/login')
        .send({ token: '123456' });
      
      expect(res.status).toBe(429);
      expect(res.body.error).toContain('Too many');
    });
  });

  describe('POST /oauth/token - OAuth Token Rate Limiting', () => {
    it('should allow up to 20 token requests within window', async () => {
      // OAuth has higher limit (20) to allow refresh flows
      for (let i = 0; i < 20; i++) {
        const res = await request(app)
          .post('/oauth/token')
          .send({
            grant_type: 'authorization_code',
            code: 'invalid',
            client_id: 'test',
            client_secret: 'test',
          });
        
        // Should not be rate limited
        expect(res.status).not.toBe(429);
      }
    });

    it('should block 21st token request with 429 status', async () => {
      // Make 20 requests first
      for (let i = 0; i < 20; i++) {
        await request(app)
          .post('/oauth/token')
          .send({
            grant_type: 'authorization_code',
            code: 'invalid',
            client_id: 'test',
            client_secret: 'test',
          });
      }
      
      // 21st request should be rate limited
      const res = await request(app)
        .post('/oauth/token')
        .send({
          grant_type: 'authorization_code',
          code: 'invalid',
          client_id: 'test',
          client_secret: 'test',
        });
      
      expect(res.status).toBe(429);
      expect(res.body.error).toContain('Too many');
    });
  });

  describe('POST /password - Password Change Rate Limiting', () => {
    it('should allow up to 5 password changes within window', async () => {
      for (let i = 0; i < 5; i++) {
        const res = await request(app)
          .post('/password')
          .send({ password: 'newpassword123' });
        
        // Should not be rate limited
        expect(res.status).not.toBe(429);
      }
    });

    it('should block 6th password change with 429 status', async () => {
      // Make 5 requests first
      for (let i = 0; i < 5; i++) {
        await request(app)
          .post('/password')
          .send({ password: 'newpassword123' });
      }
      
      // 6th request should be rate limited
      const res = await request(app)
        .post('/password')
        .send({ password: 'newpassword123' });
      
      expect(res.status).toBe(429);
      expect(res.body.error).toContain('Too many');
    });
  });

  describe('Rate Limiting Disabled', () => {
    it('should not apply rate limits when skipRateLimiting is true', async () => {
      // Create app with rate limiting disabled
      const appNoLimit = createApp({ skipSession: true, skipRateLimiting: true });
      
      // Make 10 requests - none should be rate limited
      for (let i = 0; i < 10; i++) {
        const res = await request(appNoLimit)
          .post('/login')
          .send({ email: 'test@test.com', password: 'wrongpassword' });
        
        // Should not be rate limited
        expect(res.status).not.toBe(429);
      }
    });
  });

  describe('Global Rate Limiting', () => {
    it('should have global rate limit for all endpoints', async () => {
      // Global limit is 500 requests per 15 minutes
      // We won't test all 500, but verify the header exists
      const res = await request(app).get('/user');
      
      // Should have rate limit headers
      expect(res.headers['ratelimit-limit']).toBeDefined();
    });
  });
});
