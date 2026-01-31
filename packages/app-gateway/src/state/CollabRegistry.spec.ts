import { CollabRegistry } from './CollabRegistry';
import type { ProjectRoomsManager } from './ProjectRooms';

describe('CollabRegistry', () => {
  let registry: CollabRegistry;
  let mockProjectRooms: jest.Mocked<ProjectRoomsManager>;

  beforeEach(() => {
    // Use fake timers to prevent YJS internal timers from keeping tests alive
    jest.useFakeTimers();

    // Create mock ProjectRoomsManager
    mockProjectRooms = {
      getRoomId: jest.fn((project_id: string) => `room-${project_id}`),
      getYDoc: jest.fn(),
      initializeProject: jest.fn(),
      saveToSerializable: jest.fn(),
      loadFromSerialized: jest.fn(),
      getAllProjectIds: jest.fn(() => []),
      setReducers: jest.fn(),
    } as unknown as jest.Mocked<ProjectRoomsManager>;

    registry = new CollabRegistry();
    registry.setProjectRooms(mockProjectRooms);
  });

  afterEach(() => {
    // Clean up timers and restore real timers
    jest.clearAllTimers();
    jest.useRealTimers();
  });

  describe('registerSharedData', () => {
    it('should register a map type shared data', () => {
      registry.registerSharedData('map', 'test-module', 'test-data');

      // Verify schema is stored (internal state check via getCollabForProject)
      const collab = registry.getCollabForProject('test-project');
      expect(collab.sharedData['test-module:test-data']).toBeDefined();
    });

    it('should register an array type shared data', () => {
      registry.registerSharedData('array', 'test-module', 'test-list');

      const collab = registry.getCollabForProject('test-project');
      expect(collab.sharedData['test-module:test-list']).toBeDefined();
    });

    it('should allow registering multiple schemas for same module', () => {
      registry.registerSharedData('map', 'test-module', 'data1');
      registry.registerSharedData('array', 'test-module', 'data2');
      registry.registerSharedData('map', 'test-module', 'data3');

      const collab = registry.getCollabForProject('test-project');
      expect(collab.sharedData['test-module:data1']).toBeDefined();
      expect(collab.sharedData['test-module:data2']).toBeDefined();
      expect(collab.sharedData['test-module:data3']).toBeDefined();
    });

    it('should allow different modules to use same data name', () => {
      registry.registerSharedData('map', 'module-a', 'items');
      registry.registerSharedData('map', 'module-b', 'items');

      const collab = registry.getCollabForProject('test-project');
      expect(collab.sharedData['module-a:items']).toBeDefined();
      expect(collab.sharedData['module-b:items']).toBeDefined();
    });
  });

  describe('getCollabForProject', () => {
    beforeEach(() => {
      registry.registerSharedData('map', 'test-module', 'data');
    });

    it('should create new collab instance for first access', () => {
      const collab1 = registry.getCollabForProject('project-1');

      expect(collab1).toBeDefined();
      expect(mockProjectRooms.getRoomId).toHaveBeenCalledWith('project-1');
    });

    it('should return cached instance on subsequent access', () => {
      const collab1 = registry.getCollabForProject('project-1');
      const collab2 = registry.getCollabForProject('project-1');

      expect(collab1).toBe(collab2); // Same instance
      expect(mockProjectRooms.getRoomId).toHaveBeenCalledTimes(1); // Only called once
    });

    it('should create separate instances for different projects', () => {
      const collab1 = registry.getCollabForProject('project-1');
      const collab2 = registry.getCollabForProject('project-2');

      expect(collab1).toBeDefined();
      expect(collab2).toBeDefined();
      expect(collab1).not.toBe(collab2); // Different instances
    });

    it('should apply all registered schemas to new instance', () => {
      registry.registerSharedData('map', 'module-a', 'data1');
      registry.registerSharedData('array', 'module-b', 'data2');
      registry.registerSharedData('map', 'module-c', 'data3');

      const collab = registry.getCollabForProject('new-project');

      expect(collab.sharedData['module-a:data1']).toBeDefined();
      expect(collab.sharedData['module-b:data2']).toBeDefined();
      expect(collab.sharedData['module-c:data3']).toBeDefined();
    });

    it('should throw error if ProjectRoomsManager not set', () => {
      const unsetRegistry = new CollabRegistry();
      unsetRegistry.registerSharedData('map', 'test', 'data');

      expect(() => {
        unsetRegistry.getCollabForProject('project-1');
      }).toThrow(
        'CollabRegistry: ProjectRooms not set. Call setProjectRooms() first.'
      );
    });
  });

  describe('setProjectRooms', () => {
    it('should allow setting ProjectRoomsManager once', () => {
      const newRegistry = new CollabRegistry();
      expect(() => {
        newRegistry.setProjectRooms(mockProjectRooms);
      }).not.toThrow();
    });

    it('should throw error if set multiple times', () => {
      const newRegistry = new CollabRegistry();
      newRegistry.setProjectRooms(mockProjectRooms);

      expect(() => {
        newRegistry.setProjectRooms(mockProjectRooms);
      }).toThrow('CollabRegistry: ProjectRoomsManager already set');
    });
  });

  describe('project isolation', () => {
    beforeEach(() => {
      registry.registerSharedData('map', 'test', 'items');
    });

    it('should maintain separate data for different projects', () => {
      const collab1 = registry.getCollabForProject('project-1');
      const collab2 = registry.getCollabForProject('project-2');

      // Add data to project 1
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (collab1.sharedData['test:items'] as any).set('key1', 'value1');

      // Verify project 2 doesn't have this data
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const project2Data = collab2.sharedData['test:items'] as any;
      expect(project2Data.get('key1')).toBeUndefined();
    });

    it('should maintain isolation across multiple operations', () => {
      // Use unique project IDs to avoid cached instances from previous test
      const collab1 = registry.getCollabForProject('project-iso-1');
      const collab2 = registry.getCollabForProject('project-iso-2');

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const map1 = collab1.sharedData['test:items'] as any;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const map2 = collab2.sharedData['test:items'] as any;

      // Multiple operations on project 1
      map1.set('a', 1);
      map1.set('b', 2);
      map1.set('c', 3);

      // Multiple operations on project 2
      map2.set('x', 10);
      map2.set('y', 20);

      // Verify isolation
      expect(map1.size).toBe(3);
      expect(map2.size).toBe(2);
      expect(map1.get('x')).toBeUndefined();
      expect(map2.get('a')).toBeUndefined();
    });
  });

  describe('schema registration timing', () => {
    it('should allow schema registration before ProjectRoomsManager is set', () => {
      const newRegistry = new CollabRegistry();
      expect(() => {
        newRegistry.registerSharedData('map', 'test', 'data');
      }).not.toThrow();
    });

    it('should allow schema registration after collab instances created', () => {
      registry.registerSharedData('map', 'module-a', 'data1');
      const collab = registry.getCollabForProject('project-1');

      // Register new schema after instance created
      registry.registerSharedData('map', 'module-b', 'data2');

      // New projects should have both schemas
      const newCollab = registry.getCollabForProject('project-2');
      expect(newCollab.sharedData['module-a:data1']).toBeDefined();
      expect(newCollab.sharedData['module-b:data2']).toBeDefined();

      // But existing instance won't have the new schema
      // (This is expected behavior - schema is applied at creation time)
      expect(collab.sharedData['module-b:data2']).toBeUndefined();
    });
  });

  describe('memory and performance', () => {
    it('should cache instances efficiently', () => {
      registry.registerSharedData('map', 'test', 'data');

      // Access same project 100 times
      const project_id = 'test-project';
      const instances = [];

      for (let i = 0; i < 100; i++) {
        instances.push(registry.getCollabForProject(project_id));
      }

      // All should be the same instance
      const firstInstance = instances[0];
      instances.forEach((instance) => {
        expect(instance).toBe(firstInstance);
      });

      // ProjectRoomsManager.getRoomId should only be called once
      expect(mockProjectRooms.getRoomId).toHaveBeenCalledTimes(1);
    });

    it('should handle many projects efficiently', () => {
      registry.registerSharedData('map', 'test', 'data');

      // Create 1000 projects
      const collabs = [];
      for (let i = 0; i < 1000; i++) {
        collabs.push(registry.getCollabForProject(`project-${i}`));
      }

      expect(collabs.length).toBe(1000);
      expect(mockProjectRooms.getRoomId).toHaveBeenCalledTimes(1000);
    });
  });

  describe('edge cases', () => {
    it('should handle empty project_id gracefully', () => {
      registry.registerSharedData('map', 'test', 'data');

      expect(() => {
        registry.getCollabForProject('');
      }).not.toThrow();

      const collab = registry.getCollabForProject('');
      expect(collab).toBeDefined();
    });

    it('should handle special characters in project_id', () => {
      registry.registerSharedData('map', 'test', 'data');

      const specialIds = [
        'project-with-dashes',
        'project_with_underscores',
        'project.with.dots',
        'project:with:colons',
        'project/with/slashes',
      ];

      specialIds.forEach((id) => {
        expect(() => {
          registry.getCollabForProject(id);
        }).not.toThrow();
      });
    });

    it('should handle module name with special characters', () => {
      expect(() => {
        registry.registerSharedData('map', 'my-module', 'data');
        registry.registerSharedData('map', 'my_module', 'data');
        registry.registerSharedData('map', 'my.module', 'data');
      }).not.toThrow();

      const collab = registry.getCollabForProject('test');
      expect(collab.sharedData['my-module:data']).toBeDefined();
      expect(collab.sharedData['my_module:data']).toBeDefined();
      expect(collab.sharedData['my.module:data']).toBeDefined();
    });
  });
});
