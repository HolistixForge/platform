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
  let mockRunnersMap: Map<string, any>;
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

    mockRunnersMap = new Map();
    const runnersSharedMap = {
      get: (key: string) => mockRunnersMap.get(key),
      set: (key: string, value: any) => mockRunnersMap.set(key, value),
      copy: () => new Map(mockRunnersMap),
    };

    mockDepsExports = {
      collab: {
        registry: {
          getCollabForProject: jest.fn(() => ({
            sharedData: {
              'user-containers:containers': new Map(),
              'user-containers:images': imagesSharedMap,
              'user-containers:runners': runnersSharedMap,
            },
          })),
        },
      },
      gateway: {
        organization_id: 'org-under-test',
        permissionRegistry: {
          getPermissions: jest.fn(() => ({})),
        },
      },
      'user-containers': {
        imageRegistry: mockImageRegistry,
        listRunnerIds: () => ['local'],
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

  it('syncs only this project catalogue, not another one', async () => {
    // The shared map is a CRDT replicated to every client in the project, so an
    // unscoped sync would hand one tenant's image list to another's browsers.
    mockImageRegistry.registerForProject('test-project-123', 'ours', [
      {
        imageId: 'ours:etl',
        imageName: 'Our ETL',
        imageUri: 'ghcr.io/ours/etl',
        imageTag: '1.0.0',
        imageSha256: 'a'.repeat(64),
      },
    ]);
    mockImageRegistry.registerForProject('some-other-project', 'theirs', [
      {
        imageId: 'theirs:sim',
        imageName: 'Their Simulator',
        imageUri: 'ghcr.io/theirs/sim',
        imageTag: '2.0.0',
        imageSha256: 'b'.repeat(64),
      },
    ]);

    await reducer.reduce(
      {
        type: 'project:init' as const,
        project_id: 'test-project-123',
        systemEvent: true as const,
      },
      { project_id: 'test-project-123' } as any
    );

    expect(mockImagesMap.has('ours:etl')).toBe(true);
    expect(mockImagesMap.has('theirs:sim')).toBe(false);
  });

  it('publishes the runners this gateway actually offers', async () => {
    // The platform runner only registers where a broker is configured, so the
    // frontend has no way to know the set without being told.
    await reducer.reduce(
      {
        type: 'project:init' as const,
        project_id: 'test-project-123',
        systemEvent: true as const,
      },
      { project_id: 'test-project-123' } as any
    );

    expect(Array.from(mockRunnersMap.keys())).toEqual(['local']);
    expect(mockRunnersMap.get('local')).toEqual({ runnerId: 'local' });
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
        recordVpnCredentials: jest.fn(),
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
        // `_delete` asks the runner to remove the container before it removes
        // any reference to it, so a reducer without one cannot delete.
        getRunner: () => ({ start: jest.fn(), stop: jest.fn() }),
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

    it('should store the auth guard client id in container shared state', async () => {
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
      });
    });

    it('should keep the client secret out of shared state entirely', async () => {
      // Shared state is a CRDT replicated to every client in the project, so a
      // secret anywhere in the container record is a secret handed to every
      // collaborator's browser — check the whole serialised record, not just
      // the auth_guard field.
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

      const containers = Array.from(mockContainersMap.values());
      expect(JSON.stringify(containers)).not.toContain(
        'guard-client-secret-abc'
      );
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

  describe('_start - Auth guard secret handling', () => {
    /** Wire up the extra deps `_start` needs, and capture the runner config. */
    const armStart = () => {
      const started: { config?: any; container?: any } = {};
      mockDepsExports.gateway.tokenManager = {
        generateProjectScopedToken: jest
          .fn()
          .mockResolvedValue('hosting-token'),
      };
      mockDepsExports['user-containers'].getRunner = jest.fn(() => ({
        start: jest.fn(
          async (container: any, _t: any, _r: any, config: any) => {
            started.container = container;
            started.config = config;
            return { command: 'docker run ...' };
          }
        ),
      }));
      return started;
    };

    const startEvent = {
      type: 'user-container:start' as const,
      user_container_id: 'uc-1',
    };

    const requestData = {
      project_id: 'project-1',
      jwt: { type: 'access_token', user: { id: 'user-1' } },
    } as any;

    const newEvent = {
      type: 'user-container:new' as const,
      containerName: 'My Terminal',
      imageId: 'ubuntu:terminal',
      project_id: 'project-1',
    };

    /**
     * Create a container through the reducer and pick a runner for it.
     *
     * Its generated id is kept as-is: the in-memory secret is keyed on it, so
     * renaming the container here would fake the very cache miss the next test
     * sets up deliberately.
     */
    const createStartableContainer = async () => {
      await reducer.reduce(newEvent, requestData);
      const [created] = Array.from(mockContainersMap.values());
      mockContainersMap.set(created.user_container_id, {
        ...created,
        runner: { id: 'local' },
      });
      return created.user_container_id as string;
    };

    it('passes the secret held in memory without touching Ganymede again', async () => {
      const containerId = await createStartableContainer();
      const started = armStart();
      mockToGanymedeInternal.mockClear();

      await reducer.reduce(
        { ...startEvent, user_container_id: containerId },
        requestData
      );

      expect(started.config.auth_guard_client_secret).toBe(
        'guard-client-secret-abc'
      );
      // The secret was already known, so no rotation round-trip.
      expect(mockToGanymedeInternal).not.toHaveBeenCalled();
    });

    it('rotates the OAuth client when the secret was lost with the gateway', async () => {
      // A gateway restart between create and start: shared state survives (it
      // is a CRDT), the in-memory secret does not. Ganymede only holds a bcrypt
      // hash, so the client has to be replaced rather than recovered.
      mockContainersMap.set('uc-1', {
        user_container_id: 'uc-1',
        container_name: 'My Terminal',
        image_id: 'ubuntu:terminal',
        runner: { id: 'local' },
        auth_guard: { client_id: 'stale-client' },
        httpServices: [],
        last_watchdog_at: null,
        last_activity: null,
        created_at: new Date().toISOString(),
      });
      const started = armStart();
      mockToGanymedeInternal.mockClear();
      mockToGanymedeInternal.mockResolvedValue({
        client_id: 'fresh-client',
        client_secret: 'fresh-secret',
      });

      await reducer.reduce(startEvent, requestData);

      expect(mockToGanymedeInternal).toHaveBeenCalledWith(
        expect.objectContaining({
          url: '/internal/oauth/clients/stale-client',
          method: 'DELETE',
        })
      );
      expect(started.config.auth_guard_client_secret).toBe('fresh-secret');
      // The new client id must reach shared state, or the guard would announce
      // a client id Ganymede no longer knows.
      expect(mockContainersMap.get('uc-1').auth_guard).toEqual({
        client_id: 'fresh-client',
      });
      expect(
        JSON.stringify(Array.from(mockContainersMap.values()))
      ).not.toContain('fresh-secret');
    });

    it('starts without guard config when re-registration fails', async () => {
      mockContainersMap.set('uc-1', {
        user_container_id: 'uc-1',
        container_name: 'My Terminal',
        image_id: 'ubuntu:terminal',
        runner: { id: 'local' },
        auth_guard: { client_id: 'stale-client' },
        httpServices: [],
        last_watchdog_at: null,
        last_activity: null,
        created_at: new Date().toISOString(),
      });
      const started = armStart();
      mockToGanymedeInternal.mockRejectedValue(new Error('Ganymede down'));

      await reducer.reduce(startEvent, requestData);

      expect(started.config.auth_guard_client_secret).toBeUndefined();
    });
  });

  describe('placementsFor - what a polling runner is handed', () => {
    /** The extra deps the placement path needs, none of which `_new` uses. */
    /** Arms the deps, and captures the config the runner is handed. */
    const armPlacements = () => {
      const captured: { config?: any } = {};
      mockDepsExports.gateway.tokenManager = {
        generateProjectScopedToken: jest
          .fn()
          .mockResolvedValue('hosting-token'),
      };
      mockDepsExports['user-containers'].getRunner = jest.fn(() => ({
        buildLaunchSpec: (
          container: any,
          _token: any,
          _registry: any,
          config: any
        ) => {
          captured.config = config;
          return {
            name: `holistix_${container.user_container_id}`,
            imageRef: 'holistixforge/ubuntu-terminal:24.04',
            settings: 'e30=',
            capabilities: [],
            devices: [],
            extraHosts: [],
          };
        },
      }));
      return captured;
    };

    const placedLocally = (extra: Record<string, unknown> = {}) => ({
      user_container_id: 'uc-1',
      container_name: 'My Terminal',
      image_id: 'ubuntu:terminal',
      runner: { id: 'local', machine_id: 'machine-1', user_id: 'user-1' },
      httpServices: [],
      last_watchdog_at: null,
      last_activity: null,
      created_at: new Date().toISOString(),
      ...extra,
    });

    it('writes a rotated OAuth client id back to shared state', async () => {
      // The gateway restarted, so the secret is gone and the client is
      // replaced. Used locally only, the next poll would answer from the
      // secret cache and pair the *new* secret with the id still in the
      // document — a login the container cannot complete, with nothing in
      // either place looking wrong on its own.
      mockContainersMap.set(
        'uc-1',
        placedLocally({
          auth_guard: { client_id: 'stale-client' },
        })
      );
      armPlacements();
      mockToGanymedeInternal.mockResolvedValue({
        client_id: 'fresh-client',
        client_secret: 'fresh-secret',
      });

      await reducer.placementsFor('project-1', 'machine-1');

      expect(mockContainersMap.get('uc-1').auth_guard).toEqual({
        client_id: 'fresh-client',
      });
      // And the secret still never reaches the CRDT.
      expect(
        JSON.stringify(Array.from(mockContainersMap.values()))
      ).not.toContain('fresh-secret');
    });

    it('tells a machine-hosted container it is on a development platform', async () => {
      // `gateway_dev` becomes `GATEWAY_DEV` in SETTINGS, and the container's
      // auth guard passes `--insecure-skip-verify` on it. Without it the guard
      // cannot fetch Ganymede's public key over the dev platform's self-signed
      // TLS, exits, and the service answers 404 — while the same container
      // started on the platform works, because `_start` did set the flag.
      //
      // The third field to be added to one config builder and not the other;
      // both now come from `_runnerConfig`, so there is one place to forget.
      mockDepsExports.gateway.environment = { devMode: true };
      mockContainersMap.set('uc-1', placedLocally());
      const captured = armPlacements();

      await reducer.placementsFor('project-1', 'machine-1');

      expect(captured.config.gateway_dev).toBe(true);
      expect(captured.config.dev_host_ip).toBe('host-gateway');
    });

    it('says nothing about dev mode on a real deployment', async () => {
      mockDepsExports.gateway.environment = { devMode: false };
      mockContainersMap.set('uc-1', placedLocally());
      const captured = armPlacements();

      await reducer.placementsFor('project-1', 'machine-1');

      expect(captured.config.gateway_dev).toBe(false);
      expect(captured.config.dev_host_ip).toBeUndefined();
    });

    it('marks a placement of a built-in image as built-in', async () => {
      // The runner refuses an image that is not digest-pinned, and no built-in
      // carries a digest — so without this the default terminal image, the one
      // thing everybody has, was refused on every machine. The flag comes from
      // the registry rather than from the container document, so a tenant image
      // cannot claim it.
      mockContainersMap.set('uc-1', placedLocally());
      armPlacements();

      const [placement] = await reducer.placementsFor('project-1', 'machine-1');

      expect(placement.builtin).toBe(true);
    });

    it('does not mark a tenant image as built-in', async () => {
      mockImageRegistry.registerForProject('project-1', 'acme', [
        {
          imageId: 'acme:etl',
          imageName: 'Our ETL',
          imageUri: 'ghcr.io/acme/etl',
          imageTag: '1.0.0',
          imageSha256: 'a'.repeat(64),
        },
      ]);
      mockContainersMap.set('uc-1', placedLocally({ image_id: 'acme:etl' }));
      armPlacements();

      const [placement] = await reducer.placementsFor('project-1', 'machine-1');

      expect(placement.builtin).toBe(false);
    });

    it('names no network, so the runner forms no opinion about them', async () => {
      mockContainersMap.set('uc-1', placedLocally());
      armPlacements();

      const [placement] = await reducer.placementsFor('project-1', 'machine-1');

      expect(placement.networks).toEqual([]);
    });

    it('skips a container placed locally with no owner recorded', async () => {
      // `_start` refuses the same case. Handing the runner a placement whose
      // user is empty would start a container that cannot say who it is for.
      mockContainersMap.set(
        'uc-1',
        placedLocally({
          runner: { id: 'local', machine_id: 'machine-1' },
        })
      );
      armPlacements();

      expect(await reducer.placementsFor('project-1', 'machine-1')).toEqual([]);
    });

    it('answers only for the machine that asked', async () => {
      mockContainersMap.set('uc-1', placedLocally());
      mockContainersMap.set(
        'uc-2',
        placedLocally({
          user_container_id: 'uc-2',
          runner: { id: 'local', machine_id: 'machine-2', user_id: 'user-1' },
        })
      );
      armPlacements();

      const placements = await reducer.placementsFor('project-1', 'machine-1');

      expect(placements.map((p) => p.user_container_id)).toEqual(['uc-1']);
    });
  });
});

describe('UserContainersReducer - runner machines', () => {
  let reducer: UserContainersReducer;
  let machines: Map<string, any>;

  const sharedMap = (backing: Map<string, any>) => ({
    get: (k: string) => backing.get(k),
    set: (k: string, v: any) => backing.set(k, v),
    delete: (k: string) => backing.delete(k),
    forEach: (fn: (v: any) => void) => backing.forEach(fn),
    copy: () => new Map(backing),
  });

  const health = (
    userId: string | undefined,
    machineId = 'm1',
    label = 'mbp'
  ) =>
    reducer.reduce(
      {
        type: 'user-container:runner-health' as const,
        machine_id: machineId,
        label,
        systemEvent: true as const,
      },
      {
        project_id: 'p1',
        jwt: userId ? { user: { id: userId } } : undefined,
      } as any
    );

  beforeEach(() => {
    machines = new Map();
    reducer = new UserContainersReducer({
      collab: {
        registry: {
          getCollabForProject: jest.fn(() => ({
            sharedData: {
              'user-containers:containers': sharedMap(new Map()),
              'user-containers:machines': sharedMap(machines),
            },
          })),
        },
      },
      gateway: {
        organization_id: 'org-1',
        // _periodic republishes the project's routes on every tick.
        updateReverseProxy: jest.fn(),
      },
      'user-containers': {},
    } as any);
  });

  it('records a machine against the authenticated user', async () => {
    await health('user-a');

    expect(machines.get('m1')).toMatchObject({
      machine_id: 'm1',
      user_id: 'user-a',
      label: 'mbp',
    });
    expect(machines.get('m1').last_health_at).toBeTruthy();
  });

  it('takes the owner from the token, never from the event', async () => {
    // A runner that could name its own owner could enrol itself into a project
    // it was never invited to.
    await expect(health(undefined)).rejects.toThrow();
    expect(machines.size).toBe(0);
  });

  it('refuses a machine id already claimed by someone else', async () => {
    // Not a naming collision to resolve — an id being reused, deliberately or
    // from a restored backup. Letting it through would hand one member another
    // member's placement.
    await health('user-a');

    // Asserting on the rejection rather than its text: the ForbiddenException
    // mocked at the top of this file takes an array of messages and Error
    // stringifies it, so the message never survives. What matters is that the
    // owner is unchanged.
    await expect(health('user-b')).rejects.toBeTruthy();
    expect(machines.get('m1').user_id).toBe('user-a');
  });

  it('refreshes the timestamp on each health', async () => {
    await health('user-a');
    const first = machines.get('m1').last_health_at;

    await new Promise((r) => setTimeout(r, 5));
    await health('user-a');

    expect(machines.get('m1').last_health_at).not.toBe(first);
  });

  it('drops a machine that stopped answering', async () => {
    await health('user-a');
    machines.set('m1', {
      ...machines.get('m1'),
      last_health_at: new Date('2020-01-01').toISOString(),
    });

    await reducer.reduce(
      {
        type: 'reducers:periodic' as const,
        date: new Date().toISOString(),
      } as any,
      { project_id: 'p1' } as any
    );

    expect(machines.has('m1')).toBe(false);
  });

  it('keeps a machine that answered recently', async () => {
    await health('user-a');

    await reducer.reduce(
      {
        type: 'reducers:periodic' as const,
        date: new Date().toISOString(),
      } as any,
      { project_id: 'p1' } as any
    );

    expect(machines.has('m1')).toBe(true);
  });
});

/**
 * A local placement names a machine, and Ganymede decides whether it may.
 *
 * The rule — only a machine's own owner makes the first placement on it —
 * cannot be checked against this document: the machine catalog here only holds
 * machines whose runner is already heartbeating into this project, and the
 * first placement is what puts one there. So the reducer asks Ganymede, and
 * what these tests hold in place is that it asks *before* writing, and that a
 * refusal leaves nothing behind.
 */
describe('UserContainersReducer - _setRunner and the machine it names', () => {
  let reducer: UserContainersReducer;
  let containers: Map<string, any>;
  let toGanymede: jest.Mock;

  const CONTAINER = 'uc-1';

  beforeEach(() => {
    containers = new Map([
      [CONTAINER, { user_container_id: CONTAINER, runner: { id: 'none' } }],
    ]);

    toGanymede = jest.fn().mockResolvedValue({});

    reducer = new UserContainersReducer({
      collab: {
        registry: {
          getCollabForProject: jest.fn(() => ({
            sharedData: {
              'user-containers:containers': {
                get: (k: string) => containers.get(k),
                set: (k: string, v: any) => containers.set(k, v),
                copy: () => new Map(containers),
              },
            },
          })),
        },
      },
      reducers: { processEvent: jest.fn() },
      gateway: { toGanymede, organization_id: 'org-1' },
      'user-containers': {
        listRunnerIds: () => ['local', 'platform'],
        getRunner: (id: string) => ({ id }),
      },
    } as any);
  });

  const setRunner = (extra: Record<string, unknown> = {}) =>
    reducer.reduce(
      {
        type: 'user-container:set-runner',
        user_container_id: CONTAINER,
        runner_id: 'local',
        ...extra,
      } as any,
      {
        project_id: 'project-1',
        jwt: { user: { id: 'user-1' } },
      } as any
    );

  it('should opt the machine into the project before writing the placement', async () => {
    // Act
    await setRunner({ machine_id: 'machine-1' });

    // Assert
    expect(toGanymede).toHaveBeenCalledWith({
      url: '/internal/runners/machine-1/projects',
      method: 'POST',
      jsonBody: { project_id: 'project-1', user_id: 'user-1' },
    });
    expect(containers.get(CONTAINER).runner).toEqual({
      id: 'local',
      user_id: 'user-1',
      machine_id: 'machine-1',
    });
  });

  it('should take the owner from the token and never from the event', async () => {
    // Act - a client claiming the machine belongs to somebody else
    await setRunner({ machine_id: 'machine-1', user_id: 'someone-else' });

    // Assert - a client that could name the owner could opt a machine it does
    // not own into a project it was never invited to
    expect(toGanymede.mock.calls[0][0].jsonBody.user_id).toBe('user-1');
    expect(containers.get(CONTAINER).runner.user_id).toBe('user-1');
  });

  it('should write nothing when Ganymede refuses the machine', async () => {
    // Arrange - not this user's machine, revoked, or unknown; Ganymede answers
    // the same way for all three
    toGanymede.mockRejectedValue(new Error('403'));

    // Act / Assert
    await expect(setRunner({ machine_id: 'machine-1' })).rejects.toThrow();

    // A container written here would sit forever looking like it was about to
    // start, because no runner would ever be handed the placement
    expect(containers.get(CONTAINER).runner).toEqual({ id: 'none' });
  });

  it('should still accept a placement that names no machine', async () => {
    // Act - the mode that hands the user a `docker run` to paste, which works
    // and which nothing here should break
    await setRunner();

    // Assert - no grant to record, because no machine was named
    expect(toGanymede).not.toHaveBeenCalled();
    expect(containers.get(CONTAINER).runner).toEqual({
      id: 'local',
      user_id: 'user-1',
    });
  });

  it('should not opt anything in for a platform placement', async () => {
    // Act
    await reducer.reduce(
      {
        type: 'user-container:set-runner',
        user_container_id: CONTAINER,
        runner_id: 'platform',
        machine_id: 'machine-1',
      } as any,
      { project_id: 'project-1', jwt: { user: { id: 'user-1' } } } as any
    );

    // Assert - the platform belongs to no one and is not a machine anyone
    // opts into; a machine_id here is meaningless and must not be recorded
    expect(toGanymede).not.toHaveBeenCalled();
    expect(containers.get(CONTAINER).runner).toEqual({ id: 'platform' });
  });

  it('should refuse a local placement with no project to grant against', async () => {
    // Arrange / Act
    const refused = reducer.reduce(
      {
        type: 'user-container:set-runner',
        user_container_id: CONTAINER,
        runner_id: 'local',
        machine_id: 'machine-1',
      } as any,
      { jwt: { user: { id: 'user-1' } } } as any
    );

    // Assert
    await expect(refused).rejects.toThrow();
    expect(toGanymede).not.toHaveBeenCalled();
  });
});

/**
 * The VPN needs to know which hosting token belongs to which container.
 *
 * `vpn-auth-verify.sh` has read that file since it was written and nothing has
 * ever produced it — so the per-client identity it exists for could not have
 * worked: a missing file means every connection refused. These tests are about
 * producing it. Nothing here turns the feature on; the server only asks for a
 * username and password when VPN_PER_CLIENT_IDENTITY is set, which it is not.
 */
describe('UserContainersReducer - VPN credentials', () => {
  let reducer: UserContainersReducer;
  let containers: Map<string, any>;
  let recordVpnCredentials: jest.Mock;

  beforeEach(() => {
    containers = new Map([
      [
        'uc-1',
        {
          user_container_id: 'uc-1',
          container_name: 'one',
          image_id: 'ubuntu:terminal',
          runner: { id: 'local', user_id: 'user-1' },
          httpServices: [],
        },
      ],
    ]);

    recordVpnCredentials = jest.fn();

    reducer = new UserContainersReducer({
      collab: {
        registry: {
          getCollabForProject: jest.fn(() => ({
            sharedData: {
              'user-containers:containers': {
                get: (k: string) => containers.get(k),
                set: (k: string, v: any) => containers.set(k, v),
                copy: () => new Map(containers),
                delete: (k: string) => containers.delete(k),
                forEach: (fn: any) => containers.forEach(fn),
              },
            },
          })),
        },
      },
      reducers: { processEvent: jest.fn() },
      gateway: {
        recordVpnCredentials,
        toGanymedeInternal: jest.fn().mockResolvedValue({}),
        updateReverseProxy: jest.fn(),
        gatewayFQDN: 'org-1.domain.local',
        organization_id: 'org-1',
        environment: { devMode: false, dockerHostIp: '172.17.0.1' },
        tokenManager: {
          generateProjectScopedToken: jest
            .fn()
            .mockResolvedValue('the-hosting-token'),
        },
        permissionManager: { hasPermission: () => true },
      },
      'user-containers': {
        getRunner: () => ({
          start: jest.fn().mockResolvedValue({}),
          // Deleting now reaches the runner, which is the point of the change
          // this mock predates.
          stop: jest.fn().mockResolvedValue(undefined),
        }),
        imageRegistry: {
          get: () => ({
            imageId: 'ubuntu:terminal',
            imageUri: 'x',
            imageTag: '1',
          }),
        },
      },
    } as any);
  });

  const start = () =>
    reducer.reduce(
      { type: 'user-container:start', user_container_id: 'uc-1' } as any,
      { project_id: 'project-1', jwt: { user: { id: 'user-1' } } } as any
    );

  it('should record a short secret, not the hosting token', async () => {
    // OpenVPN keeps a password in a fixed buffer — 128 bytes on the Alpine
    // build of 2.6, larger on the Ubuntu one, and `--max-password-size` only
    // arrives in 2.7. A hosting token is a JWT of some 740 bytes, so the same
    // container was admitted or refused depending on which base image it was
    // built from, and the server could only say "wrong password". Measured: an
    // Alpine container presented 127 characters of a 743-character token.
    await start();

    const [recorded] = recordVpnCredentials.mock.calls.at(-1) as [
      { user_container_id: string; token: string }[]
    ];

    expect(recorded).toHaveLength(1);
    expect(recorded[0].user_container_id).toBe('uc-1');
    expect(recorded[0].token).not.toBe('the-hosting-token');
    // Well inside every build's buffer, and not guessable.
    expect(recorded[0].token).toMatch(/^[0-9a-f]{32}$/);
  });

  it('should give the runner the same secret it recorded', async () => {
    // Two halves of one comparison: what the gateway writes for
    // vpn-auth-verify.sh, and what the container is told to present. Minted in
    // one place precisely so they cannot drift — and the hosting token still
    // travels beside it, for everything that is not the VPN.
    const startSpy = jest.fn().mockResolvedValue({});
    (reducer as any).depsExports['user-containers'].getRunner = () => ({
      start: startSpy,
    });

    await start();

    const [recorded] = recordVpnCredentials.mock.calls.at(-1) as [
      { user_container_id: string; token: string }[]
    ];
    const [, hostingToken, , config] = startSpy.mock.calls[0];

    expect(config.vpn_secret).toBe(recorded[0].token);
    expect(hostingToken).toBe('the-hosting-token');
  });

  it('should record it before the container is asked to start', async () => {
    // Arrange
    const order: string[] = [];
    recordVpnCredentials.mockImplementation(() => order.push('record'));
    (reducer as any).depsExports['user-containers'].getRunner = () => ({
      start: async () => (order.push('start'), {}),
    });

    // Act
    await start();

    // Assert - the other order is a race the container loses by being refused,
    // which from the UI looks like a service that will not come up
    expect(order).toEqual(['record', 'start']);
  });

  it('should drop the credential when the container is deleted', async () => {
    // Arrange
    await start();
    recordVpnCredentials.mockClear();

    // Act
    await reducer.reduce(
      { type: 'user-container:delete', user_container_id: 'uc-1' } as any,
      { project_id: 'project-1', jwt: { user: { id: 'user-1' } } } as any
    );

    // Assert - a token left in the file is one that would still admit whatever
    // presented it
    expect(recordVpnCredentials).toHaveBeenCalledWith([]);
  });
});

//

describe('UserContainersReducer - stopping a service without deleting it', () => {
  let reducer: UserContainersReducer;
  let containers: Map<string, any>;
  let updateReverseProxy: jest.Mock;
  let runnerStop: jest.Mock;

  beforeEach(() => {
    containers = new Map([
      [
        'uc-1',
        {
          user_container_id: 'uc-1',
          container_name: 'one',
          image_id: 'ubuntu:terminal',
          runner: { id: 'platform' },
          ip: '172.16.0.4',
          httpServices: [
            { host: 'n8n.uc-uc-1.org-1.domain.local', name: 'n8n', port: 5678 },
          ],
        },
      ],
    ]);

    updateReverseProxy = jest.fn();
    runnerStop = jest.fn().mockResolvedValue(undefined);

    reducer = new UserContainersReducer({
      collab: {
        registry: {
          getCollabForProject: jest.fn(() => ({
            sharedData: {
              'user-containers:containers': {
                get: (k: string) => containers.get(k),
                set: (k: string, v: any) => containers.set(k, v),
                copy: () => new Map(containers),
                delete: (k: string) => containers.delete(k),
                forEach: (fn: any) => containers.forEach(fn),
              },
            },
          })),
        },
      },
      reducers: { processEvent: jest.fn() },
      gateway: {
        recordVpnCredentials: jest.fn(),
        toGanymedeInternal: jest.fn().mockResolvedValue({}),
        updateReverseProxy,
        gatewayFQDN: 'org-1.domain.local',
        organization_id: 'org-1',
        permissionManager: { hasPermission: () => true },
      },
      'user-containers': {
        getRunner: () => ({ start: jest.fn(), stop: runnerStop }),
        imageRegistry: { get: () => ({ imageId: 'ubuntu:terminal' }) },
      },
    } as any);
  });

  const stop = () =>
    reducer.reduce(
      { type: 'user-container:stop', user_container_id: 'uc-1' } as any,
      { project_id: 'project-1', jwt: { user: { id: 'user-1' } } } as any
    );

  it('asks the runner to stop and keeps the container', async () => {
    await stop();

    expect(runnerStop).toHaveBeenCalledTimes(1);
    expect(containers.get('uc-1')).toBeDefined();
    expect(containers.get('uc-1').stopped_at).toEqual(expect.any(String));
  });

  it('takes the service off the gateway rather than waiting for the watchdog', async () => {
    // `_periodic` would clear these thirty seconds later, and in those thirty
    // seconds the gateway proxies the FQDN to a VPN address nobody is on.
    await stop();

    expect(containers.get('uc-1').httpServices).toEqual([]);
    expect(updateReverseProxy).toHaveBeenCalledWith('project-1', []);
  });

  it('refuses without an authenticated user', async () => {
    await expect(
      reducer.reduce(
        { type: 'user-container:stop', user_container_id: 'uc-1' } as any,
        { project_id: 'project-1', jwt: {} } as any
      )
    ).rejects.toThrow();
    expect(runnerStop).not.toHaveBeenCalled();
  });

  it('does not mark a container stopped when the runner refused', async () => {
    // The card would say stopped for a container that is still serving, and
    // there would be no button left that tries again.
    runnerStop.mockRejectedValue(new Error('broker is down'));

    await expect(stop()).rejects.toThrow('broker is down');
    expect(containers.get('uc-1').stopped_at).toBeUndefined();
  });

  it('leaves a local placement out of the list once stopped', async () => {
    containers.set('uc-2', {
      user_container_id: 'uc-2',
      container_name: 'two',
      image_id: 'ubuntu:terminal',
      runner: { id: 'local', user_id: 'user-1', machine_id: 'm-1' },
      httpServices: [],
      stopped_at: new Date().toISOString(),
    });

    const placements = await reducer.placementsFor('project-1', 'm-1');

    expect(placements.map((p) => p.user_container_id)).not.toContain('uc-2');
  });
});

//

describe('UserContainersReducer - deleting a service removes the service', () => {
  let reducer: UserContainersReducer;
  let containers: Map<string, any>;
  let runnerStop: jest.Mock;
  let updateReverseProxy: jest.Mock;
  let processEvent: jest.Mock;

  beforeEach(() => {
    containers = new Map([
      [
        'uc-1',
        {
          user_container_id: 'uc-1',
          container_name: 'one',
          image_id: 'ubuntu:terminal',
          runner: { id: 'platform' },
          httpServices: [],
        },
      ],
    ]);
    runnerStop = jest.fn().mockResolvedValue(undefined);
    updateReverseProxy = jest.fn();
    processEvent = jest.fn();

    reducer = new UserContainersReducer({
      collab: {
        registry: {
          getCollabForProject: jest.fn(() => ({
            sharedData: {
              'user-containers:containers': {
                get: (k: string) => containers.get(k),
                set: (k: string, v: any) => containers.set(k, v),
                copy: () => new Map(containers),
                delete: (k: string) => containers.delete(k),
                forEach: (fn: any) => containers.forEach(fn),
              },
            },
          })),
        },
      },
      reducers: { processEvent },
      gateway: {
        recordVpnCredentials: jest.fn(),
        toGanymedeInternal: jest.fn().mockResolvedValue({}),
        updateReverseProxy,
        gatewayFQDN: 'org-1.domain.local',
        organization_id: 'org-1',
        permissionManager: { hasPermission: () => true },
      },
      'user-containers': {
        getRunner: () => ({ start: jest.fn(), stop: runnerStop }),
        imageRegistry: { get: () => ({ imageId: 'ubuntu:terminal' }) },
      },
    } as any);
  });

  const del = () =>
    reducer.reduce(
      { type: 'user-container:delete', user_container_id: 'uc-1' } as any,
      { project_id: 'project-1', jwt: { user: { id: 'user-1' } } } as any
    );

  it('asks the runner to remove the container, not only its references', async () => {
    // Everything else `_delete` does removes a *reference*: the credential, the
    // OAuth client, the shared-state entry, the nginx route, the node. None of
    // it touches what is running. Measured before this: four deleted services
    // still alive on the platform holding 9.4 GB, and nineteen private networks
    // for three containers — the broker removes a network with its container
    // and was never asked.
    await del();

    expect(runnerStop).toHaveBeenCalledTimes(1);
    expect(containers.get('uc-1')).toBeUndefined();
  });

  it('keeps the service when the runner could not remove it', async () => {
    // Removing the references and swallowing the failure is what produces an
    // orphan while reporting success.
    runnerStop.mockRejectedValue(new Error('broker is down'));

    await expect(del()).rejects.toThrow('broker is down');
    expect(containers.get('uc-1')).toBeDefined();
  });

  it('still takes the service off the gateway and the whiteboard', async () => {
    await del();

    expect(updateReverseProxy).toHaveBeenCalledWith('project-1', []);
    expect(processEvent).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'core:delete-node' }),
      expect.anything()
    );
  });
});
