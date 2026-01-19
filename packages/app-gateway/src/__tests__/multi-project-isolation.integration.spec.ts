/**
 * Integration tests for multi-project data isolation
 * Ensures complete isolation between projects in all scenarios
 */

import { ProjectRoomsManager } from '../state/ProjectRooms';
import { CollabRegistry } from '../state/CollabRegistry';
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
    __resetMockDocs: () => mockDocs.clear(),
  };
});

const ywsUtils = require('y-websocket/bin/utils');

// Mock YjsServerCollab with minimal implementation
jest.mock('@holistix-forge/collab', () => {
  const actual = jest.requireActual('@holistix-forge/collab');
  
  // Mock Y.Array-like object
  class MockYArray extends Array {
    push(items: any[]) {
      // Y.Array push takes an array and adds each element
      super.push(...items);
      return this.length;
    }
    toArray() {
      return Array.from(this);
    }
  }
  
  class MockYjsServerCollab {
    sharedData: Record<string, Map<string, any> | any> = {};
    sharedTypes: any = {};
    sharedEditor: any = {};
    
    loadSharedData(type: 'map' | 'array', moduleName: string, name: string) {
      const key = `${moduleName}:${name}`;
      if (type === 'map') {
        this.sharedData[key] = new Map();
      } else {
        this.sharedData[key] = new MockYArray();
      }
    }
  }
  
  return {
    ...actual,
    YjsServerCollab: MockYjsServerCollab,
  };
});

describe('Multi-Project Data Isolation', () => {
  let projectRooms: ProjectRoomsManager;
  let registry: CollabRegistry;

  beforeEach(() => {
    if (ywsUtils.__resetMockDocs) {
      ywsUtils.__resetMockDocs();
    }
    jest.clearAllMocks();

    projectRooms = new ProjectRoomsManager();
    registry = new CollabRegistry();
    registry.setProjectRooms(projectRooms);

    // Register common shared data types
    registry.registerSharedData('map', 'test', 'items');
    registry.registerSharedData('array', 'test', 'list');
    registry.registerSharedData('map', 'test', 'users');
  });

  describe('basic isolation', () => {
    it('should isolate map data between projects', async () => {
      await projectRooms.initializeProject('project-a');
      await projectRooms.initializeProject('project-b');

      const collabA = registry.getCollabForProject('project-a');
      const collabB = registry.getCollabForProject('project-b');

      const itemsA = collabA.sharedData['test:items'] as Map<string, string>;
      const itemsB = collabB.sharedData['test:items'] as Map<string, string>;

      // Add data to project A
      itemsA.set('key1', 'value-from-a');
      itemsA.set('key2', 'another-value-a');

      // Add data to project B
      itemsB.set('key1', 'value-from-b');
      itemsB.set('key3', 'different-value-b');

      // Verify isolation
      expect(itemsA.size).toBe(2);
      expect(itemsB.size).toBe(2);
      expect(itemsA.get('key1')).toBe('value-from-a');
      expect(itemsB.get('key1')).toBe('value-from-b');
      expect(itemsA.has('key3')).toBe(false);
      expect(itemsB.has('key2')).toBe(false);
    });

    it('should isolate array data between projects', async () => {
      await projectRooms.initializeProject('project-a');
      await projectRooms.initializeProject('project-b');

      const collabA = registry.getCollabForProject('project-a');
      const collabB = registry.getCollabForProject('project-b');

      const listA = collabA.sharedData['test:list'] as Y.Array<string>;
      const listB = collabB.sharedData['test:list'] as Y.Array<string>;

      // Add data to both projects
      listA.push(['item-a-1', 'item-a-2']);
      listB.push(['item-b-1', 'item-b-2', 'item-b-3']);

      // Verify isolation
      expect(listA.length).toBe(2);
      expect(listB.length).toBe(3);
      expect(listA.toArray()).toEqual(['item-a-1', 'item-a-2']);
      expect(listB.toArray()).toEqual(['item-b-1', 'item-b-2', 'item-b-3']);
    });

    it('should use separate Y.Doc instances', async () => {
      await projectRooms.initializeProject('project-a');
      await projectRooms.initializeProject('project-b');

      const ydocA = projectRooms.getYDoc('project-a');
      const ydocB = projectRooms.getYDoc('project-b');

      expect(ydocA).not.toBe(ydocB);
      expect(ydocA.clientID).not.toBe(ydocB.clientID);
    });

    it('should have different room_ids', async () => {
      await projectRooms.initializeProject('project-a');
      await projectRooms.initializeProject('project-b');

      const roomA = projectRooms.getRoomId('project-a');
      const roomB = projectRooms.getRoomId('project-b');

      expect(roomA).not.toBe(roomB);
    });
  });

  describe('concurrent access', () => {
    it('should handle simultaneous writes to different projects', async () => {
      await projectRooms.initializeProject('project-1');
      await projectRooms.initializeProject('project-2');

      const collab1 = registry.getCollabForProject('project-1');
      const collab2 = registry.getCollabForProject('project-2');

      const items1 = collab1.sharedData['test:items'] as Map<string, number>;
      const items2 = collab2.sharedData['test:items'] as Map<string, number>;

      // Simulate concurrent writes
      const promises = [];
      for (let i = 0; i < 100; i++) {
        promises.push(
          Promise.resolve().then(() => {
            items1.set(`key-${i}`, i);
            items2.set(`key-${i}`, i + 1000);
          })
        );
      }

      await Promise.all(promises);

      // Verify isolation maintained
      expect(items1.size).toBe(100);
      expect(items2.size).toBe(100);

      // Verify correct values
      expect(items1.get('key-50')).toBe(50);
      expect(items2.get('key-50')).toBe(1050);
    });

    it('should handle concurrent reads from different projects', async () => {
      await projectRooms.initializeProject('project-1');
      await projectRooms.initializeProject('project-2');

      const collab1 = registry.getCollabForProject('project-1');
      const collab2 = registry.getCollabForProject('project-2');

      const items1 = collab1.sharedData['test:items'] as Map<string, string>;
      const items2 = collab2.sharedData['test:items'] as Map<string, string>;

      items1.set('shared-key', 'value-1');
      items2.set('shared-key', 'value-2');

      // Concurrent reads
      const results = await Promise.all([
        Promise.resolve(items1.get('shared-key')),
        Promise.resolve(items2.get('shared-key')),
        Promise.resolve(items1.get('shared-key')),
        Promise.resolve(items2.get('shared-key')),
      ]);

      expect(results).toEqual(['value-1', 'value-2', 'value-1', 'value-2']);
    });
  });

  describe('cross-project operations', () => {
    it('should not affect other projects when modifying one', async () => {
      // Create 3 projects
      await projectRooms.initializeProject('project-1');
      await projectRooms.initializeProject('project-2');
      await projectRooms.initializeProject('project-3');

      const collab1 = registry.getCollabForProject('project-1');
      const collab2 = registry.getCollabForProject('project-2');
      const collab3 = registry.getCollabForProject('project-3');

      // Initialize all with same key
      const items1 = collab1.sharedData['test:items'] as Map<string, number>;
      const items2 = collab2.sharedData['test:items'] as Map<string, number>;
      const items3 = collab3.sharedData['test:items'] as Map<string, number>;

      items1.set('count', 1);
      items2.set('count', 2);
      items3.set('count', 3);

      // Modify only project 2
      for (let i = 0; i < 100; i++) {
        items2.set(`key-${i}`, i);
      }

      // Verify project 1 and 3 unchanged
      expect(items1.size).toBe(1);
      expect(items1.get('count')).toBe(1);

      expect(items2.size).toBe(101); // count + 100 keys
      expect(items2.get('count')).toBe(2);

      expect(items3.size).toBe(1);
      expect(items3.get('count')).toBe(3);
    });

    it('should maintain isolation during bulk operations', async () => {
      await projectRooms.initializeProject('project-a');
      await projectRooms.initializeProject('project-b');

      const collabA = registry.getCollabForProject('project-a');
      const collabB = registry.getCollabForProject('project-b');

      const itemsA = collabA.sharedData['test:items'] as Map<string, string>;
      const itemsB = collabB.sharedData['test:items'] as Map<string, string>;

      // Bulk add to A
      const bulkDataA = new Map<string, string>();
      for (let i = 0; i < 1000; i++) {
        bulkDataA.set(`item-${i}`, `value-a-${i}`);
      }
      bulkDataA.forEach((value, key) => itemsA.set(key, value));

      // Bulk add to B
      const bulkDataB = new Map<string, string>();
      for (let i = 0; i < 500; i++) {
        bulkDataB.set(`item-${i}`, `value-b-${i}`);
      }
      bulkDataB.forEach((value, key) => itemsB.set(key, value));

      // Verify correct sizes and values
      expect(itemsA.size).toBe(1000);
      expect(itemsB.size).toBe(500);
      expect(itemsA.get('item-100')).toBe('value-a-100');
      expect(itemsB.get('item-100')).toBe('value-b-100');
    });
  });

  describe('persistence and restoration', () => {
    it('should maintain isolation after save/load cycle', async () => {
      // Create and populate projects
      await projectRooms.initializeProject('project-1');
      await projectRooms.initializeProject('project-2');

      const collab1 = registry.getCollabForProject('project-1');
      const collab2 = registry.getCollabForProject('project-2');

      const items1 = collab1.sharedData['test:items'] as Map<string, string>;
      const items2 = collab2.sharedData['test:items'] as Map<string, string>;

      items1.set('key-a', 'value-from-project-1');
      items2.set('key-a', 'value-from-project-2');

      // Serialize
      const serialized = projectRooms.saveToSerializable();

      // Restore in new instances
      const newProjectRooms = new ProjectRoomsManager();
      const newRegistry = new CollabRegistry();
      newRegistry.setProjectRooms(newProjectRooms);
      newRegistry.registerSharedData('map', 'test', 'items');

      // Must initialize projects first, then load snapshot
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

    it('should handle partial restoration without cross-contamination', async () => {
      await projectRooms.initializeProject('project-1');
      await projectRooms.initializeProject('project-2');

      const collab1 = registry.getCollabForProject('project-1');
      const items1 = collab1.sharedData['test:items'] as Map<string, string>;
      items1.set('data', 'project-1-data');

      // Serialize only project 1
      const serialized = projectRooms.saveToSerializable();
      const partial = { 'project-1': serialized['project-1'] };

      // Restore with existing project 2
      const newProjectRooms = new ProjectRoomsManager();
      await newProjectRooms.initializeProject('project-2');

      const newRegistry = new CollabRegistry();
      newRegistry.setProjectRooms(newProjectRooms);
      newRegistry.registerSharedData('map', 'test', 'items');

      const newCollab2 = newRegistry.getCollabForProject('project-2');
      const newItems2 = newCollab2.sharedData['test:items'] as Map<string, string>;
      newItems2.set('data', 'fresh-project-2-data');

      // Load project 1 snapshot
      newProjectRooms.loadFromSerialized(partial);

      // Verify project 2 not affected
      expect(newItems2.get('data')).toBe('fresh-project-2-data');
    });
  });

  describe('scalability and stress testing', () => {
    it('should maintain isolation with many projects', async () => {
      const projectCount = 50;

      // Create many projects
      for (let i = 0; i < projectCount; i++) {
        await projectRooms.initializeProject(`project-${i}`);
      }

      // Add unique data to each
      for (let i = 0; i < projectCount; i++) {
        const collab = registry.getCollabForProject(`project-${i}`);
        const items = collab.sharedData['test:items'] as Map<string, number>;
        items.set('project-id', i);
        items.set('unique-value', i * 100);
      }

      // Verify isolation
      for (let i = 0; i < projectCount; i++) {
        const collab = registry.getCollabForProject(`project-${i}`);
        const items = collab.sharedData['test:items'] as Map<string, number>;
        
        expect(items.get('project-id')).toBe(i);
        expect(items.get('unique-value')).toBe(i * 100);
      }
    });

    it('should handle large datasets per project without leakage', async () => {
      await projectRooms.initializeProject('project-heavy-1');
      await projectRooms.initializeProject('project-heavy-2');

      const collab1 = registry.getCollabForProject('project-heavy-1');
      const collab2 = registry.getCollabForProject('project-heavy-2');

      const items1 = collab1.sharedData['test:items'] as Map<string, string>;
      const items2 = collab2.sharedData['test:items'] as Map<string, string>;

      // Add 10k items to each project
      for (let i = 0; i < 10000; i++) {
        items1.set(`key-${i}`, `value-1-${i}`);
        items2.set(`key-${i}`, `value-2-${i}`);
      }

      // Verify sizes
      expect(items1.size).toBe(10000);
      expect(items2.size).toBe(10000);

      // Spot check values
      expect(items1.get('key-5000')).toBe('value-1-5000');
      expect(items2.get('key-5000')).toBe('value-2-5000');
      expect(items1.get('key-9999')).toBe('value-1-9999');
      expect(items2.get('key-9999')).toBe('value-2-9999');
    });
  });

  describe('edge cases', () => {
    it('should handle projects with similar IDs', async () => {
      await projectRooms.initializeProject('project-1');
      await projectRooms.initializeProject('project-10');
      await projectRooms.initializeProject('project-11');

      const collab1 = registry.getCollabForProject('project-1');
      const collab10 = registry.getCollabForProject('project-10');
      const collab11 = registry.getCollabForProject('project-11');

      const items1 = collab1.sharedData['test:items'] as Map<string, number>;
      const items10 = collab10.sharedData['test:items'] as Map<string, number>;
      const items11 = collab11.sharedData['test:items'] as Map<string, number>;

      items1.set('id', 1);
      items10.set('id', 10);
      items11.set('id', 11);

      expect(items1.get('id')).toBe(1);
      expect(items10.get('id')).toBe(10);
      expect(items11.get('id')).toBe(11);
    });

    it('should handle empty project_id edge cases', async () => {
      // Empty string project ID
      await projectRooms.initializeProject('');
      
      const collabEmpty = registry.getCollabForProject('');
      const itemsEmpty = collabEmpty.sharedData['test:items'] as Map<string, string>;
      itemsEmpty.set('test', 'empty-id-value');

      // Regular project shouldn't see it
      await projectRooms.initializeProject('regular-project');
      const collabRegular = registry.getCollabForProject('regular-project');
      const itemsRegular = collabRegular.sharedData['test:items'] as Map<string, string>;

      expect(itemsEmpty.has('test')).toBe(true);
      expect(itemsRegular.has('test')).toBe(false);
    });
  });
});

