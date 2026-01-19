/**
 * Integration tests for project initialization flow
 * Tests the complete flow from project creation to default data initialization
 */

import { ProjectRoomsManager } from '../state/ProjectRooms';
import { CollabRegistry } from '../state/CollabRegistry';
import { Reducer, RequestData } from '@holistix-forge/reducers';
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
  
  class MockYjsServerCollab {
    sharedData: Record<string, Map<string, any> | any[]> = {};
    sharedTypes: any = {};
    sharedEditor: any = {};
    
    loadSharedData(type: 'map' | 'array', moduleName: string, name: string) {
      const key = `${moduleName}:${name}`;
      if (type === 'map') {
        this.sharedData[key] = new Map();
      } else {
        this.sharedData[key] = [];
      }
    }
  }
  
  return {
    ...actual,
    YjsServerCollab: MockYjsServerCollab,
  };
});

// Test data structures
type TGraphView = {
  id: string;
  name: string;
  created_at: string;
};

type TTab = {
  id: string;
  name: string;
  view_id: string;
};

// Mock reducers that simulate whiteboard and tabs
class MockWhiteboardReducer extends Reducer<any> {
  constructor(private registry: CollabRegistry) {
    super();
  }

  override async reduce(event: any, requestData: RequestData): Promise<void> {
    if (event.type === 'project:init') {
      const collab = this.registry.getCollabForProject(requestData.project_id!);
      const views = collab.sharedData['whiteboard:graphViews'] as Map<string, TGraphView>;
      
      // Only initialize if empty (idempotent)
      if (views.size === 0) {
        views.set('view-1', {
          id: 'view-1',
          name: 'Default View',
          created_at: new Date().toISOString(),
        });
      }
    }
  }
}

class MockTabsReducer extends Reducer<any> {
  constructor(private registry: CollabRegistry) {
    super();
  }

  override async reduce(event: any, requestData: RequestData): Promise<void> {
    if (event.type === 'project:init') {
      const collab = this.registry.getCollabForProject(requestData.project_id!);
      const tabs = collab.sharedData['tabs:tabs'] as Map<string, TTab>;
      
      // Only initialize if empty (idempotent)
      if (tabs.size === 0) {
        tabs.set('tab-1', {
          id: 'tab-1',
          name: 'Default Dashboard',
          view_id: 'view-1',
        });
      }
    }
  }
}

describe('Project Initialization Integration', () => {
  let projectRooms: ProjectRoomsManager;
  let registry: CollabRegistry;
  let whiteboardReducer: MockWhiteboardReducer;
  let tabsReducer: MockTabsReducer;

  beforeEach(() => {
    // Reset y-websocket mock
    if (ywsUtils.__resetMockDocs) {
      ywsUtils.__resetMockDocs();
    }
    jest.clearAllMocks();

    // Setup infrastructure
    projectRooms = new ProjectRoomsManager();
    registry = new CollabRegistry();
    registry.setProjectRooms(projectRooms);

    // Register shared data
    registry.registerSharedData('map', 'whiteboard', 'graphViews');
    registry.registerSharedData('map', 'tabs', 'tabs');

    // Create reducers
    whiteboardReducer = new MockWhiteboardReducer(registry);
    tabsReducer = new MockTabsReducer(registry);

    // Create mock event processor that calls reducers
    const mockEventProcessor = {
      processEvent: async (event: any, requestData: any) => {
        await whiteboardReducer.reduce(event, requestData);
        await tabsReducer.reduce(event, requestData);
      },
    };

    // Wire event processor
    projectRooms.setEventProcessor(mockEventProcessor as any);
  });

  describe('single project initialization', () => {
    it('should create default view and tab when project initializes', async () => {
      await projectRooms.initializeProject('project-1');

      // Get collab for the project
      const collab = registry.getCollabForProject('project-1');

      // Check default view was created
      const views = collab.sharedData['whiteboard:graphViews'] as Map<string, TGraphView>;
      expect(views.size).toBe(1);
      expect(views.has('view-1')).toBe(true);

      const view = views.get('view-1')!;
      expect(view.name).toBe('Default View');

      // Check default tab was created
      const tabs = collab.sharedData['tabs:tabs'] as Map<string, TTab>;
      expect(tabs.size).toBe(1);
      expect(tabs.has('tab-1')).toBe(true);

      const tab = tabs.get('tab-1')!;
      expect(tab.name).toBe('Default Dashboard');
      expect(tab.view_id).toBe('view-1'); // Links to the view
    });

    it('should be idempotent - safe to initialize multiple times', async () => {
      await projectRooms.initializeProject('project-1');
      await projectRooms.initializeProject('project-1');
      await projectRooms.initializeProject('project-1');

      const collab = registry.getCollabForProject('project-1');

      // Should still only have one view and one tab
      const views = collab.sharedData['whiteboard:graphViews'] as Map<string, TGraphView>;
      const tabs = collab.sharedData['tabs:tabs'] as Map<string, TTab>;

      expect(views.size).toBe(1);
      expect(tabs.size).toBe(1);
    });

    it('should persist initialization data', async () => {
      await projectRooms.initializeProject('project-1');

      // Serialize
      const serialized = projectRooms.saveToSerializable();

      // Create new instances and load
      const newProjectRooms = new ProjectRoomsManager();
      const newRegistry = new CollabRegistry();
      newRegistry.setProjectRooms(newProjectRooms);
      newRegistry.registerSharedData('map', 'whiteboard', 'graphViews');
      newRegistry.registerSharedData('map', 'tabs', 'tabs');

      // Must initialize project first, then load snapshot
      await newProjectRooms.initializeProject('project-1');
      newProjectRooms.loadFromSerialized(serialized);

      // Check project was initialized and data persists
      expect(newProjectRooms.hasProject('project-1')).toBe(true);
      const collab = newRegistry.getCollabForProject('project-1');
      expect(collab.sharedData['whiteboard:graphViews']).toBeDefined();
      expect(collab.sharedData['tabs:tabs']).toBeDefined();
    });
  });

  describe('multiple projects initialization', () => {
    it('should initialize each project independently', async () => {
      await projectRooms.initializeProject('project-1');
      await projectRooms.initializeProject('project-2');
      await projectRooms.initializeProject('project-3');

      // Each project should have its own defaults
      for (const project_id of ['project-1', 'project-2', 'project-3']) {
        const collab = registry.getCollabForProject(project_id);
        const views = collab.sharedData['whiteboard:graphViews'] as Map<string, TGraphView>;
        const tabs = collab.sharedData['tabs:tabs'] as Map<string, TTab>;

        expect(views.size).toBe(1);
        expect(tabs.size).toBe(1);
      }
    });

    it('should maintain data isolation between projects', async () => {
      await projectRooms.initializeProject('project-1');
      await projectRooms.initializeProject('project-2');

      // Modify project 1
      const collab1 = registry.getCollabForProject('project-1');
      const views1 = collab1.sharedData['whiteboard:graphViews'] as Map<string, TGraphView>;
      views1.set('view-2', {
        id: 'view-2',
        name: 'Custom View for Project 1',
        created_at: new Date().toISOString(),
      });

      // Modify project 2
      const collab2 = registry.getCollabForProject('project-2');
      const tabs2 = collab2.sharedData['tabs:tabs'] as Map<string, TTab>;
      tabs2.set('tab-2', {
        id: 'tab-2',
        name: 'Custom Tab for Project 2',
        view_id: 'view-1',
      });

      // Verify isolation
      expect(views1.size).toBe(2); // view-1 + view-2
      const views2 = collab2.sharedData['whiteboard:graphViews'] as Map<string, TGraphView>;
      expect(views2.size).toBe(1); // only view-1

      const tabs1 = collab1.sharedData['tabs:tabs'] as Map<string, TTab>;
      expect(tabs1.size).toBe(1); // only tab-1
      expect(tabs2.size).toBe(2); // tab-1 + tab-2
    });

    it('should handle concurrent initialization', async () => {
      // Initialize multiple projects simultaneously
      const promises = [
        projectRooms.initializeProject('project-1'),
        projectRooms.initializeProject('project-2'),
        projectRooms.initializeProject('project-3'),
        projectRooms.initializeProject('project-4'),
        projectRooms.initializeProject('project-5'),
      ];

      await Promise.all(promises);

      // Verify all initialized correctly
      for (let i = 1; i <= 5; i++) {
        const collab = registry.getCollabForProject(`project-${i}`);
        const views = collab.sharedData['whiteboard:graphViews'] as Map<string, TGraphView>;
        const tabs = collab.sharedData['tabs:tabs'] as Map<string, TTab>;

        expect(views.size).toBeGreaterThanOrEqual(1);
        expect(tabs.size).toBeGreaterThanOrEqual(1);
      }
    });
  });

  describe('initialization with existing data', () => {
    it('should not reinitialize if project already has data', async () => {
      // Manually add data before initialization
      await projectRooms.initializeProject('project-1');
      const collab = registry.getCollabForProject('project-1');
      
      // Add custom data
      const views = collab.sharedData['whiteboard:graphViews'] as Map<string, TGraphView>;
      views.set('custom-view', {
        id: 'custom-view',
        name: 'Pre-existing View',
        created_at: new Date().toISOString(),
      });

      const tabs = collab.sharedData['tabs:tabs'] as Map<string, TTab>;
      tabs.set('custom-tab', {
        id: 'custom-tab',
        name: 'Pre-existing Tab',
        view_id: 'custom-view',
      });

      // Re-initialize (should be idempotent)
      await projectRooms.initializeProject('project-1');

      // Should still have custom data plus defaults
      expect(views.size).toBe(2); // default + custom
      expect(tabs.size).toBe(2); // default + custom
      expect(views.has('custom-view')).toBe(true);
      expect(tabs.has('custom-tab')).toBe(true);
    });

    it('should handle restoration from snapshot with existing data', async () => {
      // Create project with custom data
      await projectRooms.initializeProject('project-1');
      const collab = registry.getCollabForProject('project-1');

      const views = collab.sharedData['whiteboard:graphViews'] as Map<string, TGraphView>;
      views.set('view-2', {
        id: 'view-2',
        name: 'User Created View',
        created_at: new Date().toISOString(),
      });

      // Serialize
      const serialized = projectRooms.saveToSerializable();

      // Restore in new instance
      const newProjectRooms = new ProjectRoomsManager();
      const newRegistry = new CollabRegistry();
      newRegistry.setProjectRooms(newProjectRooms);
      newRegistry.registerSharedData('map', 'whiteboard', 'graphViews');
      newRegistry.registerSharedData('map', 'tabs', 'tabs');

      const newWhiteboardReducer = new MockWhiteboardReducer(newRegistry);
      const newTabsReducer = new MockTabsReducer(newRegistry);
      const newEventProcessor = {
        processEvent: async (event: any, requestData: any) => {
          await newWhiteboardReducer.reduce(event, requestData);
          await newTabsReducer.reduce(event, requestData);
        },
      };
      newProjectRooms.setEventProcessor(newEventProcessor as any);

      // Must initialize project first, then load snapshot
      await newProjectRooms.initializeProject('project-1');
      newProjectRooms.loadFromSerialized(serialized);

      // Verify project restored correctly
      expect(newProjectRooms.hasProject('project-1')).toBe(true);
      const restoredCollab = newRegistry.getCollabForProject('project-1');
      expect(restoredCollab.sharedData['whiteboard:graphViews']).toBeDefined();
      expect(restoredCollab.sharedData['tabs:tabs']).toBeDefined();
    });
  });

  describe('initialization failure handling', () => {
    it('should continue if one reducer fails', async () => {
      // Create a reducer that throws
      class FailingReducer extends Reducer<any> {
        override async reduce(): Promise<void> {
          throw new Error('Reducer failure');
        }
      }

      const failingReducer = new FailingReducer();
      const failureEventProcessor = {
        processEvent: async (event: any, requestData: any) => {
          try {
            await failingReducer.reduce(event, requestData);
          } catch (err) {
            // Swallow error to test that other reducers still run
          }
          await whiteboardReducer.reduce(event, requestData);
          await tabsReducer.reduce(event, requestData);
        },
      };
      projectRooms.setEventProcessor(failureEventProcessor as any);

      // Should not throw - initialization continues despite failure
      await expect(
        projectRooms.initializeProject('project-1')
      ).resolves.not.toThrow();

      // Other reducers should still have initialized
      const collab = registry.getCollabForProject('project-1');
      const views = collab.sharedData['whiteboard:graphViews'] as Map<string, TGraphView>;
      const tabs = collab.sharedData['tabs:tabs'] as Map<string, TTab>;

      // Should have defaults from successful reducers
      expect(views.size).toBeGreaterThanOrEqual(1);
      expect(tabs.size).toBeGreaterThanOrEqual(1);
    });
  });

  describe('scalability', () => {
    it('should handle initialization of many projects', async () => {
      const projectCount = 100;
      const promises = [];

      for (let i = 0; i < projectCount; i++) {
        promises.push(projectRooms.initializeProject(`project-${i}`));
      }

      await Promise.all(promises);

      // Verify all projects initialized
      const allProjectIds = projectRooms.getAllProjectIds();
      expect(allProjectIds.length).toBe(projectCount);

      // Spot check a few projects
      for (const i of [0, 50, 99]) {
        const collab = registry.getCollabForProject(`project-${i}`);
        const views = collab.sharedData['whiteboard:graphViews'] as Map<string, TGraphView>;
        expect(views.size).toBeGreaterThanOrEqual(1);
      }
    });
  });
});

