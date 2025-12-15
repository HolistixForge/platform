import request from 'supertest';
import express, { Express, Router } from 'express';

/**
 * SIMPLIFIED EXPRESS ENDPOINT TESTING GUIDE
 *
 * This is a minimal, working example that demonstrates:
 * - Testing Express endpoints with supertest
 * - Mocking without complex dependencies
 * - Basic HTTP request/response testing
 *
 * Start with this simple pattern and expand as needed!
 */

describe('Express Endpoint Testing - Simple Example', () => {
  let app: Express;

  beforeEach(() => {
    // Create a minimal Express app
    app = express();
    app.use(express.json());
  });

  describe('Basic GET endpoint', () => {
    it('should return data from a simple GET endpoint', async () => {
      // Setup a simple route
      app.get('/api/hello', (req, res) => {
        res.json({ message: 'Hello World' });
      });

      // Test it
      const response = await request(app).get('/api/hello').expect(200);

      expect(response.body).toEqual({ message: 'Hello World' });
    });

    it('should handle query parameters', async () => {
      app.get('/api/greet', (req, res) => {
        const name = req.query.name || 'Guest';
        res.json({ greeting: `Hello ${name}` });
      });

      const response = await request(app)
        .get('/api/greet')
        .query({ name: 'John' })
        .expect(200);

      expect(response.body).toEqual({ greeting: 'Hello John' });
    });

    it('should handle URL parameters', async () => {
      app.get('/api/users/:id', (req, res) => {
        res.json({ userId: req.params.id });
      });

      const response = await request(app).get('/api/users/123').expect(200);

      expect(response.body).toEqual({ userId: '123' });
    });
  });

  describe('POST endpoint', () => {
    it('should accept JSON body', async () => {
      app.post('/api/users', (req, res) => {
        res.status(201).json({
          created: true,
          user: req.body,
        });
      });

      const userData = { name: 'John', email: 'john@example.com' };

      const response = await request(app)
        .post('/api/users')
        .send(userData)
        .expect(201);

      expect(response.body.created).toBe(true);
      expect(response.body.user).toEqual(userData);
    });
  });

  describe('Error handling', () => {
    it('should return 404 for unknown routes', async () => {
      await request(app).get('/api/nonexistent').expect(404);
    });

    it('should handle errors with error middleware', async () => {
      app.get('/api/error', (req, res, next) => {
        next(new Error('Something went wrong'));
      });

      // Add error handler
      app.use((err: Error, req: any, res: any, next: any) => {
        res.status(500).json({ error: err.message });
      });

      const response = await request(app).get('/api/error').expect(500);

      expect(response.body).toEqual({ error: 'Something went wrong' });
    });
  });

  describe('Mocking with simple data', () => {
    it('should work with mock data', async () => {
      // Simple in-memory "database"
      const mockUsers = [
        { id: '1', name: 'Alice' },
        { id: '2', name: 'Bob' },
      ];

      app.get('/api/users', (req, res) => {
        res.json({ users: mockUsers });
      });

      app.get('/api/users/:id', (req, res) => {
        const user = mockUsers.find((u) => u.id === req.params.id);
        if (!user) {
          return res.status(404).json({ error: 'Not found' });
        }
        res.json(user);
      });

      // Test list endpoint
      const listResponse = await request(app).get('/api/users').expect(200);

      expect(listResponse.body.users).toHaveLength(2);

      // Test get by ID
      const userResponse = await request(app).get('/api/users/1').expect(200);

      expect(userResponse.body.name).toBe('Alice');

      // Test not found
      await request(app).get('/api/users/999').expect(404);
    });
  });
});

/**
 * HOW TO RUN:
 * ```bash
 * npx nx test app-ganymede --testFile=users-simple.spec.ts
 * ```
 *
 * NEXT STEPS:
 * Once this works, gradually add:
 * 1. Database mocking with jest.mock()
 * 2. Authentication middleware
 * 3. More complex route logic
 * 4. Async operations
 *
 * Keep tests simple and focused!
 */

