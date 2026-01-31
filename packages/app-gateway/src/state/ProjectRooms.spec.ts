import { ProjectRoomsManager } from './ProjectRooms';
import * as Y from 'yjs';

// Mock y-websocket utils
jest.mock('y-websocket/bin/utils', () => {
  const mockDocs = new Map<string, Y.Doc>();

  return {
    getYDoc: jest.fn((room_id: string) => {
      if (!mockDocs.has(room_id)) {
        mockDocs.set(room_id, new Y.Doc());
      }
      return mockDocs.get(room_id);
    }),
    // Reset for tests
    __resetMockDocs: () => mockDocs.clear(),
  };
});

const ywsUtils = require('y-websocket/bin/utils');

describe('ProjectRoomsManager', () => {
  let projectRooms: ProjectRoomsManager;
  beforeEach(() => {
    // Reset y-websocket mock
    if (ywsUtils.__resetMockDocs) {
      ywsUtils.__resetMockDocs();
    }
    jest.clearAllMocks();

    projectRooms = new ProjectRoomsManager();
  });

  describe('initializeProject', () => {
    it('should create a new project with unique room_id', async () => {
      await projectRooms.initializeProject('project-1');

      const room_id = projectRooms.getRoomId('project-1');
      expect(room_id).toBeDefined();
      expect(room_id).toMatch(/^[a-z0-9-]+$/); // Valid room_id format
    });

    it('should return same room_id for same project', async () => {
      await projectRooms.initializeProject('project-1');

      const room_id1 = projectRooms.getRoomId('project-1');
      const room_id2 = projectRooms.getRoomId('project-1');

      expect(room_id1).toBe(room_id2);
    });

    it('should create different room_ids for different projects', async () => {
      await projectRooms.initializeProject('project-1');
      await projectRooms.initializeProject('project-2');

      const room_id1 = projectRooms.getRoomId('project-1');
      const room_id2 = projectRooms.getRoomId('project-2');

      expect(room_id1).not.toBe(room_id2);
    });

    it('should use y-websocket managed documents', async () => {
      await projectRooms.initializeProject('project-1');

      const room_id = projectRooms.getRoomId('project-1');
      expect(ywsUtils.getYDoc).toHaveBeenCalledWith(room_id);
    });

    it('should be idempotent - safe to call multiple times', async () => {
      await projectRooms.initializeProject('project-1');
      const room_id1 = projectRooms.getRoomId('project-1');

      await projectRooms.initializeProject('project-1');
      const room_id2 = projectRooms.getRoomId('project-1');

      expect(room_id1).toBe(room_id2);
    });

    it('should dispatch project:init event when event processor is set', async () => {
      const mockProcessor = {
        processEvent: jest.fn().mockResolvedValue(undefined),
      } as any;

      projectRooms.setEventProcessor(mockProcessor);
      await projectRooms.initializeProject('project-1');

      expect(mockProcessor.processEvent).toHaveBeenCalledWith(
        { type: 'project:init', project_id: 'project-1' },
        expect.objectContaining({
          project_id: 'project-1',
          user_id: 'system',
        })
      );
    });

    it('should not dispatch project:init if already initialized', async () => {
      const mockProcessor = {
        processEvent: jest.fn().mockResolvedValue(undefined),
      } as any;

      projectRooms.setEventProcessor(mockProcessor);

      await projectRooms.initializeProject('project-1');
      await projectRooms.initializeProject('project-1');

      // Should only be called once
      expect(mockProcessor.processEvent).toHaveBeenCalledTimes(1);
    });
  });

  describe('getRoomId', () => {
    it('should return undefined if project not initialized', () => {
      const room_id = projectRooms.getRoomId('non-existent-project');
      expect(room_id).toBeUndefined();
    });

    it('should return room_id after initialization', async () => {
      await projectRooms.initializeProject('project-1');

      const room_id = projectRooms.getRoomId('project-1');
      expect(room_id).toBeDefined();
      expect(typeof room_id).toBe('string');
    });
  });

  describe('getYDoc', () => {
    it('should return undefined if project not initialized', () => {
      const ydoc = projectRooms.getYDoc('non-existent-project');
      expect(ydoc).toBeUndefined();
    });

    it('should return Y.Doc instance', async () => {
      await projectRooms.initializeProject('project-1');

      const ydoc = projectRooms.getYDoc('project-1');
      expect(ydoc).toBeInstanceOf(Y.Doc);
    });

    it('should return same Y.Doc instance on multiple calls', async () => {
      await projectRooms.initializeProject('project-1');

      const ydoc1 = projectRooms.getYDoc('project-1');
      const ydoc2 = projectRooms.getYDoc('project-1');

      expect(ydoc1).toBe(ydoc2);
    });

    it('should return different Y.Doc instances for different projects', async () => {
      await projectRooms.initializeProject('project-1');
      await projectRooms.initializeProject('project-2');

      const ydoc1 = projectRooms.getYDoc('project-1');
      const ydoc2 = projectRooms.getYDoc('project-2');

      expect(ydoc1).not.toBe(ydoc2);
    });
  });

  describe('getAllProjectIds', () => {
    it('should return empty array when no projects', () => {
      const projectIds = projectRooms.getAllProjectIds();
      expect(projectIds).toEqual([]);
    });

    it('should return all initialized project IDs', async () => {
      await projectRooms.initializeProject('project-1');
      await projectRooms.initializeProject('project-2');
      await projectRooms.initializeProject('project-3');

      const projectIds = projectRooms.getAllProjectIds();
      expect(projectIds).toHaveLength(3);
      expect(projectIds).toContain('project-1');
      expect(projectIds).toContain('project-2');
      expect(projectIds).toContain('project-3');
    });

    it('should not include duplicates', async () => {
      await projectRooms.initializeProject('project-1');
      await projectRooms.initializeProject('project-1'); // Re-initialize

      const projectIds = projectRooms.getAllProjectIds();
      expect(projectIds).toEqual(['project-1']);
    });
  });

  describe('persistence - saveToSerializable', () => {
    it('should serialize empty state', () => {
      const serialized = projectRooms.saveToSerializable();
      expect(serialized).toEqual({});
    });

    it('should serialize single project', async () => {
      await projectRooms.initializeProject('project-1');

      const serialized = projectRooms.saveToSerializable();
      expect(Object.keys(serialized)).toContain('project-1');
      // Serialized data is just the snapshot (Record<string, unknown>)
      expect(serialized['project-1']).toBeDefined();
      expect(typeof serialized['project-1']).toBe('object');
    });

    it('should serialize multiple projects', async () => {
      await projectRooms.initializeProject('project-1');
      await projectRooms.initializeProject('project-2');
      await projectRooms.initializeProject('project-3');

      const serialized = projectRooms.saveToSerializable();
      expect(Object.keys(serialized)).toHaveLength(3);
      expect(serialized).toHaveProperty('project-1');
      expect(serialized).toHaveProperty('project-2');
      expect(serialized).toHaveProperty('project-3');
    });

    it('should serialize Y.Doc state correctly', async () => {
      await projectRooms.initializeProject('project-1');

      // Modify Y.Doc
      const ydoc = projectRooms.getYDoc('project-1');
      if (ydoc) {
        const ymap = ydoc.getMap('test');
        ymap.set('key', 'value');
      }

      const serialized = projectRooms.saveToSerializable();
      expect(serialized['project-1']).toBeDefined();
      // Snapshot is the direct data, not wrapped in { snapshot: ... }
      expect(typeof serialized['project-1']).toBe('object');
    });
  });

  describe('persistence - loadFromSerialized', () => {
    it('should handle empty data', async () => {
      expect(() => {
        projectRooms.loadFromSerialized({});
      }).not.toThrow();

      expect(projectRooms.getAllProjectIds()).toEqual([]);
    });

    it('should restore single project', async () => {
      // First, create and serialize
      await projectRooms.initializeProject('project-1');
      const ydoc = projectRooms.getYDoc('project-1');
      if (ydoc) {
        const ymap = ydoc.getMap('test');
        ymap.set('key', 'original-value');
      }

      const serialized = projectRooms.saveToSerializable();

      // Create new instance and load
      const newProjectRooms = new ProjectRoomsManager();
      // Initialize the project first, then load snapshot
      await newProjectRooms.initializeProject('project-1');
      newProjectRooms.loadFromSerialized(serialized);

      // Verify restoration - project should exist
      expect(newProjectRooms.hasProject('project-1')).toBe(true);
      const restoredDoc = newProjectRooms.getYDoc('project-1');
      expect(restoredDoc).toBeDefined();
    });

    it('should restore multiple projects', async () => {
      // Create and modify multiple projects
      await projectRooms.initializeProject('project-1');
      await projectRooms.initializeProject('project-2');

      const ydoc1 = projectRooms.getYDoc('project-1');
      if (ydoc1) {
        ydoc1.getMap('test').set('id', '1');
      }

      const ydoc2 = projectRooms.getYDoc('project-2');
      if (ydoc2) {
        ydoc2.getMap('test').set('id', '2');
      }

      const serialized = projectRooms.saveToSerializable();

      // Restore in new instance - must initialize projects first
      const newProjectRooms = new ProjectRoomsManager();
      await newProjectRooms.initializeProject('project-1');
      await newProjectRooms.initializeProject('project-2');
      newProjectRooms.loadFromSerialized(serialized);

      // Verify both projects exist
      expect(newProjectRooms.getAllProjectIds()).toHaveLength(2);
      expect(newProjectRooms.hasProject('project-1')).toBe(true);
      expect(newProjectRooms.hasProject('project-2')).toBe(true);
    });

    it('should maintain data isolation after restore', async () => {
      await projectRooms.initializeProject('project-1');
      await projectRooms.initializeProject('project-2');

      const ydoc1 = projectRooms.getYDoc('project-1');
      if (ydoc1) {
        ydoc1.getMap('data').set('shared-key', 'value-from-project-1');
      }

      const ydoc2 = projectRooms.getYDoc('project-2');
      if (ydoc2) {
        ydoc2.getMap('data').set('shared-key', 'value-from-project-2');
      }

      const serialized = projectRooms.saveToSerializable();

      // Restore - must initialize projects first
      const newProjectRooms = new ProjectRoomsManager();
      await newProjectRooms.initializeProject('project-1');
      await newProjectRooms.initializeProject('project-2');
      newProjectRooms.loadFromSerialized(serialized);

      // Verify isolation maintained - both projects should exist and be separate
      expect(newProjectRooms.hasProject('project-1')).toBe(true);
      expect(newProjectRooms.hasProject('project-2')).toBe(true);

      // Verify they have different room IDs (isolation)
      const roomId1 = newProjectRooms.getRoomId('project-1');
      const roomId2 = newProjectRooms.getRoomId('project-2');
      expect(roomId1).not.toBe(roomId2);
    });
  });

  describe('setEventProcessor', () => {
    it('should allow setting event processor', () => {
      const mockProcessor = {
        processEvent: jest.fn(),
      } as any;

      expect(() => {
        projectRooms.setEventProcessor(mockProcessor);
      }).not.toThrow();
    });

    it('should use event processor for project:init events', async () => {
      const mockProcessor = {
        processEvent: jest.fn().mockResolvedValue(undefined),
      } as any;

      projectRooms.setEventProcessor(mockProcessor);
      await projectRooms.initializeProject('project-1');

      expect(mockProcessor.processEvent).toHaveBeenCalled();
    });

    it('should dispatch project:init event with correct data', async () => {
      const mockProcessor = {
        processEvent: jest.fn().mockResolvedValue(undefined),
      } as any;

      projectRooms.setEventProcessor(mockProcessor);
      await projectRooms.initializeProject('project-1');

      expect(mockProcessor.processEvent).toHaveBeenCalledWith(
        { type: 'project:init', project_id: 'project-1' },
        expect.objectContaining({
          project_id: 'project-1',
          user_id: 'system',
        })
      );
    });
  });

  describe('edge cases and error handling', () => {
    it('should handle rapid consecutive initializations', async () => {
      const promises = [
        projectRooms.initializeProject('project-1'),
        projectRooms.initializeProject('project-2'),
        projectRooms.initializeProject('project-3'),
      ];

      await Promise.all(promises);

      expect(projectRooms.getAllProjectIds()).toHaveLength(3);
    });

    it('should handle special characters in project_id', async () => {
      const specialIds = [
        'project-with-dashes',
        'project_with_underscores',
        'project.with.dots',
      ];

      for (const id of specialIds) {
        await projectRooms.initializeProject(id);
      }

      expect(projectRooms.getAllProjectIds()).toHaveLength(specialIds.length);
    });

    it('should handle very long project_id', async () => {
      const longId = 'a'.repeat(1000);

      await projectRooms.initializeProject(longId);
      expect(projectRooms.getRoomId(longId)).toBeDefined();
    });

    it('should handle initialization with pending snapshot', async () => {
      const serialized = {
        'project-1': {
          room_id: 'test-room-id',
          snapshot: new Uint8Array([1, 2, 3, 4, 5]),
        },
      };

      // Load should work even though project not initialized yet
      expect(() => {
        projectRooms.loadFromSerialized(serialized);
      }).not.toThrow();

      // Snapshot should be queued as pending (project not initialized yet)
      // When we initialize the project, it should apply the pending snapshot
      await projectRooms.initializeProject('project-1');

      // Now the project should be accessible
      expect(projectRooms.getRoomId('project-1')).toBeDefined();
    });
  });

  describe('room_id generation', () => {
    it('should generate unique room_ids for different projects', async () => {
      const roomIds = new Set<string>();

      for (let i = 0; i < 100; i++) {
        await projectRooms.initializeProject(`project-${i}`);
        const room_id = projectRooms.getRoomId(`project-${i}`);
        roomIds.add(room_id!);
      }

      // All room_ids should be unique
      expect(roomIds.size).toBe(100);
    });

    it('should generate deterministic room_id for same project', async () => {
      await projectRooms.initializeProject('test-project');
      const room_id1 = projectRooms.getRoomId('test-project');

      // Re-initialize shouldn't change room_id
      await projectRooms.initializeProject('test-project');
      const room_id2 = projectRooms.getRoomId('test-project');

      expect(room_id1).toBe(room_id2);
    });
  });
});
