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

// The route asks public-routing rather than url-helpers, because the answer
// depends on the host the request arrived on. Stubbed at that boundary: what
// this suite is about is the shape of the projects list, and the two
// arrangements it can name are covered in public-routing.spec.ts.
jest.mock('../../lib/public-routing', () => ({
  gatewayHostnameFor: (org: string) => `org-${org}.test.local`,
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

  describe('GET /runners/me/projects', () => {
    const row = {
      project_id: '8b1e2c3d-4f5a-6b7c-8d9e-0f1a2b3c4d5e',
      project_name: 'Thing',
      organization_id: '1a2b3c4d-5e6f-7a8b-9c0d-1e2f3a4b5c6d',
      owner_user_id: 'user-123',
      owner_username: 'owner',
    };

    it('should mint one token per project, scoped to that project', async () => {
      // Arrange
      jest.mocked(pg.query).mockResolvedValue(rows(row) as any);

      // Act
      const res = await request(app).get('/runners/me/projects');

      // Assert
      expect(res.status).toBe(200);
      const payload = JSON.parse(
        res.body.projects[0].token.replace(/^signed:/, '')
      );
      expect(payload).toMatchObject({
        type: 'runner_project_token',
        runner_id: 'runner-1',
        project_id: row.project_id,
        // Naming the project in the scope is what stops the token being
        // replayed against another one
        scope: [`project:${row.project_id}:access`],
      });
    });

    it('should carry the owner read from the database, not from the runner', async () => {
      // Arrange
      jest.mocked(pg.query).mockResolvedValue(rows(row) as any);

      // Act
      const res = await request(app).get('/runners/me/projects');

      // Assert - the gateway's reducers record a machine against this user, so
      // a runner able to state it could enrol itself into a project it was
      // never invited to
      const payload = JSON.parse(
        res.body.projects[0].token.replace(/^signed:/, '')
      );
      expect(payload.user).toEqual({ id: 'user-123', username: 'owner' });
      expect(jest.mocked(pg.query).mock.calls[0][1]).toEqual(['runner-1']);
    });

    it('should say where each project’s gateway answers', async () => {
      // Arrange
      jest.mocked(pg.query).mockResolvedValue(rows(row) as any);

      // Act
      const res = await request(app).get('/runners/me/projects');

      // Assert
      expect(res.body.projects[0].gateway_hostname).toBe(
        `org-${row.organization_id}.test.local`
      );
    });

    it('should return an empty list for a machine in no project', async () => {
      // Arrange - freshly enrolled, nobody has placed anything on it
      jest.mocked(pg.query).mockResolvedValue(rows(undefined) as any);

      // Act
      const res = await request(app).get('/runners/me/projects');

      // Assert - not an error; there is simply nothing for it to do yet
      expect(res.status).toBe(200);
      expect(res.body.projects).toEqual([]);
    });
  });

  describe('DELETE /runners/me', () => {
    it('should let a runner withdraw itself', async () => {
      // Arrange
      jest.mocked(pg.query).mockResolvedValue(
        rows({
          runner_id: 'runner-1',
          revoked_at: '2026-08-05T00:00:00.000Z',
        }) as any
      );

      // Act
      const res = await request(app).delete('/runners/me');

      // Assert - revoked by its own id, taken from the token, with no id in the
      // request that could name a different machine
      expect(res.status).toBe(200);
      expect(jest.mocked(pg.query).mock.calls[0]).toEqual([
        'select * from func_runners_revoke_self($1)',
        ['runner-1'],
      ]);
    });

    it('should not be swallowed by the :runner_id route', async () => {
      // Arrange - 'me' is a perfectly good value for :runner_id, so this only
      // works because /runners/me is registered first
      jest
        .mocked(pg.query)
        .mockResolvedValue(rows({ runner_id: 'runner-1' }) as any);

      // Act
      await request(app).delete('/runners/me');

      // Assert - the owner-authenticated handler would have called the
      // two-argument revoke instead
      expect(jest.mocked(pg.query).mock.calls[0][0]).toContain(
        'func_runners_revoke_self'
      );
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
