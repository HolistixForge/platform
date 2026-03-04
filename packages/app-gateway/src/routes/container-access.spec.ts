/**
 * Container Access Verification Route Tests
 *
 * Tests the POST /containers/:containerId/verify-access endpoint
 * used by auth guard proxies inside user containers.
 */

import request from 'supertest';
import express from 'express';
import { setupContainerAccessRoutes } from './container-access';

// Mock gateway-instances
const mockGetGatewayInstances = jest.fn();
jest.mock('../initialization/gateway-instances', () => ({
  getGatewayInstances: () => mockGetGatewayInstances(),
}));

// Mock jwt-auth middleware to skip real JWT verification
jest.mock('../middleware/jwt-auth', () => ({
  authenticateJwt: (
    req: express.Request,
    _res: express.Response,
    next: express.NextFunction
  ): void => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const authReq = req as any;
    // Simulate JWT middleware: extract user from test header
    const userId = req.headers['x-test-user-id'] as string;
    if (!userId) {
      _res.status(403).json({ error: 'No authorization header' });
      return;
    }
    authReq.user = { id: userId };
    authReq.jwt = {
      type: 'access_token',
      user: { id: userId, username: `user-${userId}` },
    };
    next();
  },
}));

// Mock log to avoid noise
jest.mock('@holistix-forge/log', () => ({
  EPriority: { Debug: 'debug', Info: 'info' },
  log: jest.fn(),
}));

function createApp() {
  const app = express();
  app.use(express.json());
  const router = express.Router();
  setupContainerAccessRoutes(router);
  app.use('/', router);
  // Error handler for ForbiddenException etc.
  app.use(
    (
      err: any,
      _req: express.Request,
      res: express.Response,
      _next: express.NextFunction
    ) => {
      const status = err.statusCode || err.status || 500;
      res.status(status).json({ error: err.message || 'Internal error' });
    }
  );
  return app;
}

function createMockInstances(overrides: any = {}) {
  const mockContainerMap = new Map<string, any>();

  const mockCollab = {
    sharedData: {
      'user-containers:containers': {
        get: (key: string) => mockContainerMap.get(key),
      },
    },
  };

  const mockPermissionManager = {
    hasPermission: jest.fn().mockReturnValue(false),
    ...overrides.permissionManager,
  };

  const mockCollabRegistry = {
    getCollabForProject: jest.fn().mockReturnValue(mockCollab),
    ...overrides.collabRegistry,
  };

  const mockProjectRooms = {
    getAllProjectIds: jest.fn().mockReturnValue(['project-1']),
    ...overrides.projectRooms,
  };

  return {
    instances: {
      permissionManager: mockPermissionManager,
      collabRegistry: mockCollabRegistry,
      projectRooms: mockProjectRooms,
    },
    mockContainerMap,
    mockPermissionManager,
    mockCollabRegistry,
    mockProjectRooms,
  };
}

describe('Container Access Routes', () => {
  let app: express.Express;

  beforeEach(() => {
    jest.clearAllMocks();
    app = createApp();
  });

  describe('POST /containers/:containerId/verify-access', () => {
    it('should return allowed=true for org owner', async () => {
      const { instances, mockContainerMap, mockPermissionManager } =
        createMockInstances();
      mockContainerMap.set('container-123', {
        user_container_id: 'container-123',
      });
      mockPermissionManager.hasPermission.mockImplementation(
        (_uid: string, perm: string) => perm === 'org:owner'
      );
      mockGetGatewayInstances.mockReturnValue(instances);

      const res = await request(app)
        .post('/containers/container-123/verify-access')
        .set('x-test-user-id', 'user-1')
        .send();

      expect(res.status).toBe(200);
      expect(res.body.allowed).toBe(true);
      expect(res.body.user).toEqual({
        id: 'user-1',
        username: 'user-user-1',
        display_name: 'user-user-1',
      });
    });

    it('should return allowed=true for org admin', async () => {
      const { instances, mockContainerMap, mockPermissionManager } =
        createMockInstances();
      mockContainerMap.set('container-123', {
        user_container_id: 'container-123',
      });
      mockPermissionManager.hasPermission.mockImplementation(
        (_uid: string, perm: string) => perm === 'org:admin'
      );
      mockGetGatewayInstances.mockReturnValue(instances);

      const res = await request(app)
        .post('/containers/container-123/verify-access')
        .set('x-test-user-id', 'user-1')
        .send();

      expect(res.status).toBe(200);
      expect(res.body.allowed).toBe(true);
    });

    it('should return allowed=true for project member', async () => {
      const { instances, mockContainerMap, mockPermissionManager } =
        createMockInstances();
      mockContainerMap.set('container-123', {
        user_container_id: 'container-123',
      });
      mockPermissionManager.hasPermission.mockImplementation(
        (_uid: string, perm: string) => perm === 'project:project-1:member'
      );
      mockGetGatewayInstances.mockReturnValue(instances);

      const res = await request(app)
        .post('/containers/container-123/verify-access')
        .set('x-test-user-id', 'user-1')
        .send();

      expect(res.status).toBe(200);
      expect(res.body.allowed).toBe(true);
    });

    it('should return allowed=true for project admin', async () => {
      const { instances, mockContainerMap, mockPermissionManager } =
        createMockInstances();
      mockContainerMap.set('container-123', {
        user_container_id: 'container-123',
      });
      mockPermissionManager.hasPermission.mockImplementation(
        (_uid: string, perm: string) => perm === 'project:project-1:admin'
      );
      mockGetGatewayInstances.mockReturnValue(instances);

      const res = await request(app)
        .post('/containers/container-123/verify-access')
        .set('x-test-user-id', 'user-1')
        .send();

      expect(res.status).toBe(200);
      expect(res.body.allowed).toBe(true);
    });

    it('should handle exception during project iteration gracefully', async () => {
      const mockContainerMap2 = new Map();
      mockContainerMap2.set('container-456', {
        user_container_id: 'container-456',
      });

      const mockCollabRegistry = {
        getCollabForProject: jest
          .fn()
          .mockImplementation((projectId: string) => {
            if (projectId === 'project-1') {
              throw new Error('Collab data corrupted');
            }
            return {
              sharedData: {
                'user-containers:containers': {
                  get: (key: string) => mockContainerMap2.get(key),
                },
              },
            };
          }),
      };

      const mockPermissionManager = {
        hasPermission: jest
          .fn()
          .mockImplementation(
            (_uid: string, perm: string) => perm === 'project:project-2:member'
          ),
      };

      const instances = {
        permissionManager: mockPermissionManager,
        collabRegistry: mockCollabRegistry,
        projectRooms: {
          getAllProjectIds: jest
            .fn()
            .mockReturnValue(['project-1', 'project-2']),
        },
      };
      mockGetGatewayInstances.mockReturnValue(instances);

      // Container is in project-2, project-1 throws — should skip and find it
      const res = await request(app)
        .post('/containers/container-456/verify-access')
        .set('x-test-user-id', 'user-1')
        .send();

      expect(res.status).toBe(200);
      expect(res.body.allowed).toBe(true);
    });

    it('should return 404 when project has no user-containers data', async () => {
      const mockCollabRegistry = {
        getCollabForProject: jest.fn().mockReturnValue({
          sharedData: {
            // No 'user-containers:containers' key
          },
        }),
      };

      const instances = {
        permissionManager: { hasPermission: jest.fn() },
        collabRegistry: mockCollabRegistry,
        projectRooms: {
          getAllProjectIds: jest.fn().mockReturnValue(['project-1']),
        },
      };
      mockGetGatewayInstances.mockReturnValue(instances);

      const res = await request(app)
        .post('/containers/container-123/verify-access')
        .set('x-test-user-id', 'user-1')
        .send();

      expect(res.status).toBe(404);
      expect(res.body.error).toBe('Container not found');
    });

    it('should return allowed=false for unauthorized user', async () => {
      const { instances, mockContainerMap, mockPermissionManager } =
        createMockInstances();
      mockContainerMap.set('container-123', {
        user_container_id: 'container-123',
      });
      mockPermissionManager.hasPermission.mockReturnValue(false);
      mockGetGatewayInstances.mockReturnValue(instances);

      const res = await request(app)
        .post('/containers/container-123/verify-access')
        .set('x-test-user-id', 'user-1')
        .send();

      expect(res.status).toBe(200);
      expect(res.body.allowed).toBe(false);
    });

    it('should return 404 for unknown container', async () => {
      const { instances } = createMockInstances();
      // Container not in mock map
      mockGetGatewayInstances.mockReturnValue(instances);

      const res = await request(app)
        .post('/containers/nonexistent/verify-access')
        .set('x-test-user-id', 'user-1')
        .send();

      expect(res.status).toBe(404);
      expect(res.body.error).toBe('Container not found');
    });

    it('should return 403 without JWT (no user id)', async () => {
      const { instances } = createMockInstances();
      mockGetGatewayInstances.mockReturnValue(instances);

      const res = await request(app)
        .post('/containers/container-123/verify-access')
        .send();

      expect(res.status).toBe(403);
    });

    it('should return 500 when gateway not initialized', async () => {
      mockGetGatewayInstances.mockReturnValue(null);

      const res = await request(app)
        .post('/containers/container-123/verify-access')
        .set('x-test-user-id', 'user-1')
        .send();

      expect(res.status).toBe(500);
      expect(res.body.error).toBe('Gateway not initialized');
    });

    it('should search across multiple projects', async () => {
      // Container is in project-2, not project-1
      const mockContainerMap1 = new Map();
      const mockContainerMap2 = new Map();
      mockContainerMap2.set('container-in-p2', {
        user_container_id: 'container-in-p2',
      });

      const mockCollabRegistry = {
        getCollabForProject: jest
          .fn()
          .mockImplementation((projectId: string) => {
            const map =
              projectId === 'project-1' ? mockContainerMap1 : mockContainerMap2;
            return {
              sharedData: {
                'user-containers:containers': {
                  get: (key: string) => map.get(key),
                },
              },
            };
          }),
      };

      const mockPermissionManager = {
        hasPermission: jest
          .fn()
          .mockImplementation(
            (_uid: string, perm: string) => perm === 'project:project-2:member'
          ),
      };

      const instances = {
        permissionManager: mockPermissionManager,
        collabRegistry: mockCollabRegistry,
        projectRooms: {
          getAllProjectIds: jest
            .fn()
            .mockReturnValue(['project-1', 'project-2']),
        },
      };
      mockGetGatewayInstances.mockReturnValue(instances);

      const res = await request(app)
        .post('/containers/container-in-p2/verify-access')
        .set('x-test-user-id', 'user-1')
        .send();

      expect(res.status).toBe(200);
      expect(res.body.allowed).toBe(true);
      // Should have checked project-2 membership
      expect(mockPermissionManager.hasPermission).toHaveBeenCalledWith(
        'user-1',
        'project:project-2:member'
      );
    });
  });
});
