/**
 * Runner enrolment routes.
 *
 * What these are guarding is the difference between a token that names a
 * machine and one that names a person: the owner must come from the
 * authenticated session and never from the request, and revoking must actually
 * stop the token rather than only remove a row from a listing.
 */

import request from 'supertest';
import express from 'express';

jest.mock('../../database/pg', () => ({
  pg: {
    query: jest.fn(),
  },
}));

jest.mock('@holistix-forge/log', () => ({
  EPriority: { Info: 'info', Warning: 'warning', Error: 'error' },
  log: jest.fn(),
  error: jest.fn(),
}));

jest.mock('@holistix-forge/backend-engine', () => ({
  generateJwtToken: jest.fn(
    (payload: unknown) => `signed:${JSON.stringify(payload)}`
  ),
}));

jest.mock('../../middleware/auth', () => ({
  authenticateJwtUser: jest.fn((req: any, res: any, next: any) => {
    req.user = { id: 'user-123', username: 'owner' };
    next();
  }),
  authenticateJwtRunner: jest.fn((req: any, res: any, next: any) => {
    req.runner = { id: 'runner-1', user_id: 'user-123', label: 'laptop' };
    next();
  }),
}));

import { setupRunnerRoutes } from './index';
import { pg } from '../../database/pg';

//

const rows = (row: unknown | undefined) => ({
  next: () => ({ oneRow: () => row, allRows: () => (row ? [row] : []) }),
});

const RUNNER_ID = '7f1d0b9c-2b3a-4a5e-9c6d-8e0f1a2b3c4d';

describe('Runner routes', () => {
  let app: express.Express;

  beforeEach(() => {
    jest.clearAllMocks();
    app = express();
    app.use(express.json());
    const router = express.Router();
    setupRunnerRoutes(router);
    app.use('/', router);
  });

  describe('POST /runners', () => {
    it('should enrol the machine and hand back a token scoped to it', async () => {
      // Arrange
      jest
        .mocked(pg.query)
        .mockResolvedValue(rows({ new_runner_id: RUNNER_ID }) as any);

      // Act
      const res = await request(app).post('/runners').send({ label: 'laptop' });

      // Assert
      expect(res.status).toBe(201);
      expect(res.body.runner_id).toBe(RUNNER_ID);

      const payload = JSON.parse(res.body.token.replace(/^signed:/, ''));
      expect(payload).toEqual({
        type: 'runner_token',
        runner_id: RUNNER_ID,
        user_id: 'user-123',
        scope: `runner:${RUNNER_ID}`,
      });
      // No organization and no project: what this machine may run is decided
      // per placement, not baked into a year-long token
      expect(payload).not.toHaveProperty('organization_id');
      expect(payload).not.toHaveProperty('project_id');
    });

    it('should take the owner from the session and ignore one in the body', async () => {
      // Arrange
      jest
        .mocked(pg.query)
        .mockResolvedValue(rows({ new_runner_id: RUNNER_ID }) as any);

      // Act - a runner claiming to belong to somebody else
      const res = await request(app)
        .post('/runners')
        .send({ label: 'laptop', user_id: 'someone-else' });

      // Assert
      const params = jest.mocked(pg.query).mock.calls[0][1] as unknown[];
      expect(params[0]).toBe('user-123');

      const payload = JSON.parse(res.body.token.replace(/^signed:/, ''));
      expect(payload.user_id).toBe('user-123');
    });

    it('should refuse an empty label', async () => {
      // Act
      const res = await request(app).post('/runners').send({ label: '   ' });

      // Assert
      expect(res.status).toBe(400);
      expect(pg.query).not.toHaveBeenCalled();
    });

    it('should refuse a label longer than the column', async () => {
      // Act
      const res = await request(app)
        .post('/runners')
        .send({ label: 'x'.repeat(129) });

      // Assert - refused here rather than as a database error
      expect(res.status).toBe(400);
      expect(pg.query).not.toHaveBeenCalled();
    });
  });

  describe('GET /runners', () => {
    it("should list the caller's own runners", async () => {
      // Arrange
      jest.mocked(pg.query).mockResolvedValue(
        rows({
          runner_id: RUNNER_ID,
          label: 'laptop',
          created_at: '2026-08-05T00:00:00.000Z',
          last_seen_at: null,
          revoked_at: null,
        }) as any
      );

      // Act
      const res = await request(app).get('/runners');

      // Assert
      expect(res.status).toBe(200);
      expect(res.body.runners).toHaveLength(1);
      expect(jest.mocked(pg.query).mock.calls[0][1]).toEqual(['user-123']);
    });

    it('should never include a token in the listing', async () => {
      // Arrange - the token is minted once and not stored, so there is nothing
      // a later listing could leak
      jest.mocked(pg.query).mockResolvedValue(
        rows({
          runner_id: RUNNER_ID,
          label: 'laptop',
          created_at: '2026-08-05T00:00:00.000Z',
          last_seen_at: null,
          revoked_at: null,
        }) as any
      );

      // Act
      const res = await request(app).get('/runners');

      // Assert
      expect(JSON.stringify(res.body)).not.toMatch(/token/i);
    });
  });

  describe('DELETE /runners/:runner_id', () => {
    it('should revoke a runner it owns', async () => {
      // Arrange
      jest.mocked(pg.query).mockResolvedValue(
        rows({
          runner_id: RUNNER_ID,
          revoked_at: '2026-08-05T00:00:00.000Z',
        }) as any
      );

      // Act
      const res = await request(app).delete(`/runners/${RUNNER_ID}`);

      // Assert
      expect(res.status).toBe(200);
      expect(res.body.revoked_at).toBeTruthy();
      expect(jest.mocked(pg.query).mock.calls[0][1]).toEqual([
        RUNNER_ID,
        'user-123',
      ]);
    });

    it('should answer 404 for a runner belonging to someone else', async () => {
      // Arrange - the ownership check is in the statement, so a runner that is
      // not ours returns no row
      jest.mocked(pg.query).mockResolvedValue(rows(undefined) as any);

      // Act
      const res = await request(app).delete(`/runners/${RUNNER_ID}`);

      // Assert - same answer as a runner that does not exist, so a refusal
      // cannot be used to discover which ids are real
      expect(res.status).toBe(404);
    });
  });

  describe('GET /runners/me', () => {
    it('should tell an enrolled runner who it is', async () => {
      // Act
      const res = await request(app).get('/runners/me');

      // Assert
      expect(res.status).toBe(200);
      expect(res.body).toEqual({
        runner_id: 'runner-1',
        user_id: 'user-123',
        label: 'laptop',
      });
    });
  });
});
