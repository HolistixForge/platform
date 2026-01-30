import { CollabRegistryFrontend } from './collab-registry-frontend';
import { YjsClientCollab, YjsClientCollabConfig } from './collab';
import { LocalOverrider } from './overrider';

// Mock dependencies
jest.mock('./collab');
jest.mock('./overrider');
jest.mock('@holistix-forge/log', () => ({
  EPriority: { Info: 0, Debug: 1 },
  log: jest.fn(),
}));

describe('CollabRegistryFrontend', () => {
  let mockConfigFactory: jest.Mock<YjsClientCollabConfig, [string]>;

  beforeEach(() => {
    jest.clearAllMocks();

    // Mock config factory
    mockConfigFactory = jest.fn((project_id: string) => ({
      type: 'yjs-client' as const,
      ws_server: `wss://gateway.example.com`,
      room_id: project_id,
      token: {
        get: () => 'mock-token',
        refresh: () => {
          /* no-op for test */
        },
      },
      user: {
        username: 'TestUser',
        user_id: 'test-user-id',
        color: '#ff0000',
      },
    }));

    // Mock YjsClientCollab constructor
    (YjsClientCollab as jest.Mock).mockImplementation((config) => ({
      config,
      sharedData: {},
      destroy: jest.fn(),
    }));

    // Mock LocalOverrider constructor
    (LocalOverrider as jest.Mock).mockImplementation((sharedData) => ({
      sharedData,
    }));
  });

  describe('constructor', () => {
    it('should create a new registry', () => {
      const registry = new CollabRegistryFrontend(mockConfigFactory);
      expect(registry).toBeInstanceOf(CollabRegistryFrontend);
    });

    it('should initialize with empty cache', () => {
      const registry = new CollabRegistryFrontend(mockConfigFactory);
      expect(registry.getProjectCount()).toBe(0);
    });
  });

  describe('getCollabForProject', () => {
    it('should create collab instance on first access', () => {
      const registry = new CollabRegistryFrontend(mockConfigFactory);

      const result = registry.getCollabForProject('project-1');

      expect(mockConfigFactory).toHaveBeenCalledWith('project-1');
      expect(YjsClientCollab).toHaveBeenCalledTimes(1);
      expect(LocalOverrider).toHaveBeenCalledTimes(1);
      expect(result).toHaveProperty('collab');
      expect(result).toHaveProperty('localOverrider');
    });

    it('should cache instance and return same instance on subsequent calls', () => {
      const registry = new CollabRegistryFrontend(mockConfigFactory);

      const first = registry.getCollabForProject('project-1');
      const second = registry.getCollabForProject('project-1');

      expect(first).toBe(second);
      expect(mockConfigFactory).toHaveBeenCalledTimes(1); // Only called once
      expect(YjsClientCollab).toHaveBeenCalledTimes(1); // Only instantiated once
    });

    it('should create separate instances for different projects', () => {
      const registry = new CollabRegistryFrontend(mockConfigFactory);

      const project1 = registry.getCollabForProject('project-1');
      const project2 = registry.getCollabForProject('project-2');

      expect(project1).not.toBe(project2);
      expect(mockConfigFactory).toHaveBeenCalledTimes(2);
      expect(mockConfigFactory).toHaveBeenCalledWith('project-1');
      expect(mockConfigFactory).toHaveBeenCalledWith('project-2');
    });

    it('should use config factory to create config', () => {
      const registry = new CollabRegistryFrontend(mockConfigFactory);

      registry.getCollabForProject('project-abc');

      expect(mockConfigFactory).toHaveBeenCalledWith('project-abc');
      const config = mockConfigFactory.mock.results[0].value;
      expect(config.room_id).toBe('project-abc');
    });

    it('should create LocalOverrider with shared data from collab', () => {
      const mockSharedData = { 'tabs:tabs': new Map() };
      (YjsClientCollab as jest.Mock).mockImplementation(() => ({
        sharedData: mockSharedData,
        destroy: jest.fn(),
      }));

      const registry = new CollabRegistryFrontend(mockConfigFactory);
      registry.getCollabForProject('project-1');

      expect(LocalOverrider).toHaveBeenCalledWith(mockSharedData);
    });
  });

  describe('hasProject', () => {
    it('should return false for projects not yet initialized', () => {
      const registry = new CollabRegistryFrontend(mockConfigFactory);

      expect(registry.hasProject('project-1')).toBe(false);
    });

    it('should return true for initialized projects', () => {
      const registry = new CollabRegistryFrontend(mockConfigFactory);

      registry.getCollabForProject('project-1');

      expect(registry.hasProject('project-1')).toBe(true);
    });

    it('should return false for different project IDs', () => {
      const registry = new CollabRegistryFrontend(mockConfigFactory);

      registry.getCollabForProject('project-1');

      expect(registry.hasProject('project-1')).toBe(true);
      expect(registry.hasProject('project-2')).toBe(false);
    });
  });

  describe('getProjectCount', () => {
    it('should return 0 for new registry', () => {
      const registry = new CollabRegistryFrontend(mockConfigFactory);

      expect(registry.getProjectCount()).toBe(0);
    });

    it('should return number of initialized projects', () => {
      const registry = new CollabRegistryFrontend(mockConfigFactory);

      registry.getCollabForProject('project-1');
      expect(registry.getProjectCount()).toBe(1);

      registry.getCollabForProject('project-2');
      expect(registry.getProjectCount()).toBe(2);

      registry.getCollabForProject('project-3');
      expect(registry.getProjectCount()).toBe(3);
    });

    it('should not count duplicate accesses', () => {
      const registry = new CollabRegistryFrontend(mockConfigFactory);

      registry.getCollabForProject('project-1');
      registry.getCollabForProject('project-1');
      registry.getCollabForProject('project-1');

      expect(registry.getProjectCount()).toBe(1);
    });
  });

  describe('clearProject', () => {
    it('should remove project from cache', () => {
      const registry = new CollabRegistryFrontend(mockConfigFactory);

      registry.getCollabForProject('project-1');
      expect(registry.hasProject('project-1')).toBe(true);

      registry.clearProject('project-1');

      expect(registry.hasProject('project-1')).toBe(false);
      expect(registry.getProjectCount()).toBe(0);
    });

    it('should call destroy on collab instance', () => {
      const mockDestroy = jest.fn();
      (YjsClientCollab as jest.Mock).mockImplementation(() => ({
        sharedData: {},
        destroy: mockDestroy,
      }));

      const registry = new CollabRegistryFrontend(mockConfigFactory);
      registry.getCollabForProject('project-1');

      registry.clearProject('project-1');

      expect(mockDestroy).toHaveBeenCalled();
    });

    it('should handle clearing non-existent project gracefully', () => {
      const registry = new CollabRegistryFrontend(mockConfigFactory);

      expect(() => {
        registry.clearProject('non-existent');
      }).not.toThrow();
    });

    it('should only clear specified project', () => {
      const registry = new CollabRegistryFrontend(mockConfigFactory);

      registry.getCollabForProject('project-1');
      registry.getCollabForProject('project-2');
      registry.getCollabForProject('project-3');

      registry.clearProject('project-2');

      expect(registry.hasProject('project-1')).toBe(true);
      expect(registry.hasProject('project-2')).toBe(false);
      expect(registry.hasProject('project-3')).toBe(true);
      expect(registry.getProjectCount()).toBe(2);
    });

    it('should allow re-initializing cleared project', () => {
      const registry = new CollabRegistryFrontend(mockConfigFactory);

      const first = registry.getCollabForProject('project-1');
      registry.clearProject('project-1');
      const second = registry.getCollabForProject('project-1');

      expect(first).not.toBe(second); // New instance
      expect(YjsClientCollab).toHaveBeenCalledTimes(2); // Created twice
    });
  });

  describe('clearAll', () => {
    it('should clear all projects', () => {
      const registry = new CollabRegistryFrontend(mockConfigFactory);

      registry.getCollabForProject('project-1');
      registry.getCollabForProject('project-2');
      registry.getCollabForProject('project-3');

      registry.clearAll();

      expect(registry.getProjectCount()).toBe(0);
      expect(registry.hasProject('project-1')).toBe(false);
      expect(registry.hasProject('project-2')).toBe(false);
      expect(registry.hasProject('project-3')).toBe(false);
    });

    it('should call destroy on all collab instances', () => {
      const mockDestroy = jest.fn();
      (YjsClientCollab as jest.Mock).mockImplementation(() => ({
        sharedData: {},
        destroy: mockDestroy,
      }));

      const registry = new CollabRegistryFrontend(mockConfigFactory);

      registry.getCollabForProject('project-1');
      registry.getCollabForProject('project-2');
      registry.getCollabForProject('project-3');

      registry.clearAll();

      expect(mockDestroy).toHaveBeenCalledTimes(3);
    });

    it('should handle clearing empty registry', () => {
      const registry = new CollabRegistryFrontend(mockConfigFactory);

      expect(() => {
        registry.clearAll();
      }).not.toThrow();

      expect(registry.getProjectCount()).toBe(0);
    });
  });

  describe('Multi-project scenarios', () => {
    it('should handle many projects efficiently', () => {
      const registry = new CollabRegistryFrontend(mockConfigFactory);

      const projectCount = 100;
      for (let i = 0; i < projectCount; i++) {
        registry.getCollabForProject(`project-${i}`);
      }

      expect(registry.getProjectCount()).toBe(projectCount);
      expect(mockConfigFactory).toHaveBeenCalledTimes(projectCount);
    });

    it('should maintain separate state for each project', () => {
      const registry = new CollabRegistryFrontend(mockConfigFactory);

      const p1 = registry.getCollabForProject('project-1');
      const p2 = registry.getCollabForProject('project-2');
      const p3 = registry.getCollabForProject('project-3');

      expect(p1.collab).not.toBe(p2.collab);
      expect(p2.collab).not.toBe(p3.collab);
      expect(p1.localOverrider).not.toBe(p2.localOverrider);
    });

    it('should handle concurrent access to same project', () => {
      const registry = new CollabRegistryFrontend(mockConfigFactory);

      const results = Promise.all([
        Promise.resolve(registry.getCollabForProject('project-1')),
        Promise.resolve(registry.getCollabForProject('project-1')),
        Promise.resolve(registry.getCollabForProject('project-1')),
      ]);

      return results.then((collabs) => {
        expect(collabs[0]).toBe(collabs[1]);
        expect(collabs[1]).toBe(collabs[2]);
        expect(mockConfigFactory).toHaveBeenCalledTimes(1);
      });
    });
  });

  describe('Edge cases', () => {
    it('should handle empty string project_id', () => {
      const registry = new CollabRegistryFrontend(mockConfigFactory);

      const result = registry.getCollabForProject('');

      expect(result).toHaveProperty('collab');
      expect(mockConfigFactory).toHaveBeenCalledWith('');
    });

    it('should handle special characters in project_id', () => {
      const registry = new CollabRegistryFrontend(mockConfigFactory);

      const specialId = 'project-!@#$%^&*()';
      const result = registry.getCollabForProject(specialId);

      expect(result).toHaveProperty('collab');
      expect(mockConfigFactory).toHaveBeenCalledWith(specialId);
    });

    it('should handle very long project_id', () => {
      const registry = new CollabRegistryFrontend(mockConfigFactory);

      const longId = 'project-' + 'a'.repeat(1000);
      const result = registry.getCollabForProject(longId);

      expect(result).toHaveProperty('collab');
      expect(mockConfigFactory).toHaveBeenCalledWith(longId);
    });
  });
});
