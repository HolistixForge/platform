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

  it('should record the token the container was given', async () => {
    // Act
    await start();

    // Assert - this pair is exactly what vpn-auth-verify.sh compares against
    expect(recordVpnCredentials).toHaveBeenCalledWith([
      { user_container_id: 'uc-1', token: 'the-hosting-token' },
    ]);
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
