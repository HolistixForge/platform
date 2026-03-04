/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * Servers Reducer Tests
 *
 * Tests for user-containers servers-reducer.ts
 */

import { UserContainersReducer } from './servers-reducer';
import { ContainerImageRegistry } from './image-registry';

// Mock dependencies
jest.mock('@holistix-forge/log', () => ({
  EPriority: {
    Info: 'info',
    Warning: 'warning',
    Error: 'error',
    Debug: 'debug',
  },
  log: jest.fn(),
  error: jest.fn(),
  NotFoundException: class NotFoundException extends Error {},
  ForbiddenException: class ForbiddenException extends Error {},
}));

jest.mock('crypto', () => ({
  ...jest.requireActual('crypto'),
  randomUUID: jest.fn(() => 'test-uuid-123'),
}));

describe('ContainerImageRegistry - getAll', () => {
  it('should return empty array when no images registered', () => {
    const registry = new ContainerImageRegistry();
    expect(registry.getAll()).toEqual([]);
  });

  it('should return all registered images', () => {
    const registry = new ContainerImageRegistry();
    const images = [
      {
        imageId: 'ubuntu:terminal',
        imageName: 'Ubuntu Terminal',
        imageUri: 'holistixforge/ubuntu-terminal',
        imageTag: '24.04',
        description: 'Minimal Ubuntu container',
        category: 'utility',
      },
      {
        imageId: 'jupyter:lab',
        imageName: 'JupyterLab',
        imageUri: 'holistixforge/jupyterlab',
        imageTag: 'latest',
        description: 'JupyterLab notebook',
        category: 'data-science',
      },
    ];
    registry.register(images);

    const result = registry.getAll();
    expect(result).toHaveLength(2);
    expect(result).toEqual(expect.arrayContaining(images));
  });
});

describe('UserContainersReducer - _initProject', () => {
  let reducer: UserContainersReducer;
  let mockImagesMap: Map<string, any>;
  let mockImageRegistry: ContainerImageRegistry;
  let mockDepsExports: any;

  beforeEach(() => {
    mockImagesMap = new Map();
    mockImageRegistry = new ContainerImageRegistry();
    mockImageRegistry.register([
      {
        imageId: 'ubuntu:terminal',
        imageName: 'Ubuntu Terminal',
        imageUri: 'holistixforge/ubuntu-terminal',
        imageTag: '24.04',
        description: 'Minimal Ubuntu container',
        category: 'utility',
      },
    ]);

    // Create a mock SharedMap with copy() method
    const imagesSharedMap = {
      get: (key: string) => mockImagesMap.get(key),
      set: (key: string, value: any) => mockImagesMap.set(key, value),
      copy: () => new Map(mockImagesMap),
    };

    mockDepsExports = {
      collab: {
        registry: {
          getCollabForProject: jest.fn(() => ({
            sharedData: {
              'user-containers:containers': new Map(),
              'user-containers:images': imagesSharedMap,
            },
          })),
        },
      },
      gateway: {
        permissionRegistry: {
          getPermissions: jest.fn(() => ({})),
        },
      },
      'user-containers': {
        imageRegistry: mockImageRegistry,
      },
    };

    reducer = new UserContainersReducer(mockDepsExports as any);
  });

  it('should sync images from registry to shared map on project:init', async () => {
    const event = {
      type: 'project:init' as const,
      project_id: 'test-project-123',
      systemEvent: true as const,
    };

    const requestData = { project_id: 'test-project-123' } as any;

    await reducer.reduce(event, requestData);

    expect(mockImagesMap.size).toBe(1);
    expect(mockImagesMap.get('ubuntu:terminal')).toEqual({
      imageId: 'ubuntu:terminal',
      imageName: 'Ubuntu Terminal',
      description: 'Minimal Ubuntu container',
    });
  });

  it('should be idempotent - skip images already in shared map', async () => {
    // Pre-populate the shared map
    mockImagesMap.set('ubuntu:terminal', {
      imageId: 'ubuntu:terminal',
      imageName: 'Ubuntu Terminal',
      description: 'Minimal Ubuntu container',
    });

    const event = {
      type: 'project:init' as const,
      project_id: 'test-project-123',
      systemEvent: true as const,
    };

    const requestData = { project_id: 'test-project-123' } as any;

    await reducer.reduce(event, requestData);

    // Should still have exactly 1 entry (not duplicated)
    expect(mockImagesMap.size).toBe(1);
  });

  it('should sync multiple images', async () => {
    // Register a second image
    mockImageRegistry.register([
      {
        imageId: 'jupyter:lab',
        imageName: 'JupyterLab',
        imageUri: 'holistixforge/jupyterlab',
        imageTag: 'latest',
        description: 'JupyterLab notebook',
        category: 'data-science',
      },
    ]);

    const event = {
      type: 'project:init' as const,
      project_id: 'test-project-123',
      systemEvent: true as const,
    };

    const requestData = { project_id: 'test-project-123' } as any;

    await reducer.reduce(event, requestData);

    expect(mockImagesMap.size).toBe(2);
    expect(mockImagesMap.has('ubuntu:terminal')).toBe(true);
    expect(mockImagesMap.has('jupyter:lab')).toBe(true);
  });
});

describe('UserContainersReducer - Auth Guard OAuth Client Lifecycle', () => {
  let reducer: UserContainersReducer;
  let mockContainersMap: Map<string, any>;
  let mockImagesMap: Map<string, any>;
  let mockImageRegistry: ContainerImageRegistry;
  let mockDepsExports: any;
  let mockToGanymedeInternal: jest.Mock;

  beforeEach(() => {
    mockContainersMap = new Map();
    mockImagesMap = new Map();
    mockImageRegistry = new ContainerImageRegistry();
    mockImageRegistry.register([
      {
        imageId: 'ubuntu:terminal',
        imageName: 'Ubuntu Terminal',
        imageUri: 'holistixforge/ubuntu-terminal',
        imageTag: '24.04',
        description: 'Minimal Ubuntu container',
        category: 'utility',
      },
    ]);

    mockToGanymedeInternal = jest.fn().mockResolvedValue({
      client_id: 'guard-client-id-123',
      client_secret: 'guard-client-secret-abc',
    });

    // Create mock SharedMap-like objects
    const containersSharedMap = {
      get: (key: string) => mockContainersMap.get(key),
      set: (key: string, value: any) => mockContainersMap.set(key, value),
      delete: (key: string) => mockContainersMap.delete(key),
      copy: () => new Map(mockContainersMap),
      forEach: (fn: (v: any, k: string) => void) =>
        mockContainersMap.forEach(fn),
    };

    const imagesSharedMap = {
      get: (key: string) => mockImagesMap.get(key),
      set: (key: string, value: any) => mockImagesMap.set(key, value),
      copy: () => new Map(mockImagesMap),
    };

    mockDepsExports = {
      collab: {
        registry: {
          getCollabForProject: jest.fn(() => ({
            sharedData: {
              'user-containers:containers': containersSharedMap,
              'user-containers:images': imagesSharedMap,
            },
          })),
        },
      },
      reducers: {
        processEvent: jest.fn(),
      },
      gateway: {
        toGanymedeInternal: mockToGanymedeInternal,
        updateReverseProxy: jest.fn(),
        gatewayFQDN: 'org-abc123.domain.local',
        organization_id: 'abc123',
        permissionManager: {
          hasPermission: jest.fn().mockReturnValue(true),
        },
        permissionRegistry: {
          getPermissions: jest.fn(() => ({})),
        },
      },
      'user-containers': {
        imageRegistry: mockImageRegistry,
      },
    };

    reducer = new UserContainersReducer(mockDepsExports as any);
  });

  describe('_new - Auth guard OAuth client registration', () => {
    it('should register auth guard OAuth client via toGanymedeInternal on container creation', async () => {
      const event = {
        type: 'user-container:new' as const,
        containerName: 'My Terminal',
        imageId: 'ubuntu:terminal',
        project_id: 'project-1',
      };

      const requestData = {
        project_id: 'project-1',
        jwt: { type: 'access_token', user: { id: 'user-1' } },
      } as any;

      await reducer.reduce(event, requestData);

      // Should have called toGanymedeInternal to register OAuth client
      expect(mockToGanymedeInternal).toHaveBeenCalledWith(
        expect.objectContaining({
          url: '/internal/oauth/clients',
          method: 'POST',
          jsonBody: expect.objectContaining({
            redirect_uris: expect.arrayContaining([
              expect.stringContaining('/__auth/callback'),
            ]),
            grants: ['authorization_code', 'refresh_token'],
            label: expect.stringContaining('guard:'),
          }),
        })
      );
    });

    it('should store auth_guard config in container shared state', async () => {
      const event = {
        type: 'user-container:new' as const,
        containerName: 'My Terminal',
        imageId: 'ubuntu:terminal',
        project_id: 'project-1',
      };

      const requestData = {
        project_id: 'project-1',
        jwt: { type: 'access_token', user: { id: 'user-1' } },
      } as any;

      await reducer.reduce(event, requestData);

      // Find the container in the map (key is generated UUID)
      const containers = Array.from(mockContainersMap.values());
      expect(containers).toHaveLength(1);
      expect(containers[0].auth_guard).toEqual({
        client_id: 'guard-client-id-123',
        client_secret: 'guard-client-secret-abc',
      });
    });

    it('should gracefully handle auth guard registration failure', async () => {
      mockToGanymedeInternal.mockRejectedValue(
        new Error('Ganymede unreachable')
      );

      const event = {
        type: 'user-container:new' as const,
        containerName: 'My Terminal',
        imageId: 'ubuntu:terminal',
        project_id: 'project-1',
      };

      const requestData = {
        project_id: 'project-1',
        jwt: { type: 'access_token', user: { id: 'user-1' } },
      } as any;

      // Should not throw
      await reducer.reduce(event, requestData);

      // Container should still be created, just without auth_guard
      const containers = Array.from(mockContainersMap.values());
      expect(containers).toHaveLength(1);
      expect(containers[0].auth_guard).toBeUndefined();
    });
  });

  describe('_delete - Auth guard OAuth client cleanup', () => {
    it('should delete auth guard OAuth client via toGanymedeInternal on container deletion', async () => {
      // Pre-populate a container with auth_guard
      mockContainersMap.set('container-to-delete', {
        user_container_id: 'container-to-delete',
        container_name: 'My Terminal',
        image_id: 'ubuntu:terminal',
        runner: { id: 'none' },
        auth_guard: {
          client_id: 'guard-client-to-delete',
          client_secret: 'secret',
        },
        httpServices: [],
        last_watchdog_at: null,
        last_activity: null,
        created_at: new Date().toISOString(),
      });

      const event = {
        type: 'user-container:delete' as const,
        user_container_id: 'container-to-delete',
      };

      const requestData = {
        project_id: 'project-1',
        jwt: { type: 'access_token', user: { id: 'user-1' } },
      } as any;

      await reducer.reduce(event, requestData);

      // Should have called toGanymedeInternal to delete OAuth client
      expect(mockToGanymedeInternal).toHaveBeenCalledWith(
        expect.objectContaining({
          url: '/internal/oauth/clients/guard-client-to-delete',
          method: 'DELETE',
        })
      );
    });

    it('should not call toGanymedeInternal when container has no auth_guard', async () => {
      // Pre-populate a container without auth_guard
      mockContainersMap.set('container-no-guard', {
        user_container_id: 'container-no-guard',
        container_name: 'My Terminal',
        image_id: 'ubuntu:terminal',
        runner: { id: 'none' },
        httpServices: [],
        last_watchdog_at: null,
        last_activity: null,
        created_at: new Date().toISOString(),
      });

      const event = {
        type: 'user-container:delete' as const,
        user_container_id: 'container-no-guard',
      };

      const requestData = {
        project_id: 'project-1',
        jwt: { type: 'access_token', user: { id: 'user-1' } },
      } as any;

      await reducer.reduce(event, requestData);

      // Should NOT have called toGanymedeInternal
      expect(mockToGanymedeInternal).not.toHaveBeenCalled();
    });

    it('should gracefully handle auth guard deletion failure', async () => {
      mockToGanymedeInternal.mockRejectedValue(
        new Error('Ganymede unreachable')
      );

      mockContainersMap.set('container-fail-delete', {
        user_container_id: 'container-fail-delete',
        container_name: 'My Terminal',
        image_id: 'ubuntu:terminal',
        runner: { id: 'none' },
        auth_guard: {
          client_id: 'guard-client-fail',
          client_secret: 'secret',
        },
        httpServices: [],
        last_watchdog_at: null,
        last_activity: null,
        created_at: new Date().toISOString(),
      });

      const event = {
        type: 'user-container:delete' as const,
        user_container_id: 'container-fail-delete',
      };

      const requestData = {
        project_id: 'project-1',
        jwt: { type: 'access_token', user: { id: 'user-1' } },
      } as any;

      // Should not throw - container deletion should proceed
      await reducer.reduce(event, requestData);

      // Container should still be removed from shared state
      expect(mockContainersMap.has('container-fail-delete')).toBe(false);
    });
  });
});
