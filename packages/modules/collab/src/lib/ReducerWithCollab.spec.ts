import { ReducerWithCollab } from '../index';
import type { ICollabRegistry } from '../index';
import type { RequestData } from '@holistix-forge/reducers';
import type { Collab } from '@holistix-forge/collab-engine';

// Test event types
type TTestEvents =
  | { type: 'test:create'; id: string; data: string }
  | { type: 'test:update'; id: string; value: number };

// Test shared data
type TTestSharedData = {
  'test:items': Map<string, string>;
  'test:count': number;
};

// Concrete implementation for testing
class TestReducer extends ReducerWithCollab<TTestEvents, TTestSharedData> {
  public lastCollab: Collab<TTestSharedData> | null = null;

  override async reduce(
    event: TTestEvents,
    requestData: RequestData
  ): Promise<void> {
    switch (event.type) {
      case 'test:create':
        return this._create(event, requestData);
      case 'test:update':
        return this._update(event, requestData);
    }
  }

  private async _create(
    event: { id: string; data: string },
    requestData: RequestData
  ) {
    const collab = this.getCollab(requestData);
    this.lastCollab = collab;
    (collab.sharedData['test:items'] as Map<string, string>).set(
      event.id,
      event.data
    );
  }

  private async _update(
    event: { id: string; value: number },
    requestData: RequestData
  ) {
    const collab = this.getCollab(requestData);
    this.lastCollab = collab;
    // Just for testing
    void event.value; // use the value
  }
}

describe('ReducerWithCollab', () => {
  let mockRegistry: jest.Mocked<ICollabRegistry>;
  let mockCollab: jest.Mocked<Collab<TTestSharedData>>;
  let reducer: TestReducer;

  beforeEach(() => {
    // Create mock collab instance
    mockCollab = {
      sharedData: {
        'test:items': new Map<string, string>(),
        'test:count': 0,
      },
      sharedTypes: {} as any,
      sharedEditor: {} as any,
      loadSharedData: jest.fn(),
    } as any;

    // Create mock registry
    mockRegistry = {
      registerSharedData: jest.fn(),
      getCollabForProject: jest.fn().mockReturnValue(mockCollab),
      setProjectRooms: jest.fn(),
    } as any;

    reducer = new TestReducer(mockRegistry, 'test-module');
  });

  describe('constructor', () => {
    it('should store registry and module name', () => {
      expect(reducer['collabRegistry']).toBe(mockRegistry);
      expect(reducer['moduleName']).toBe('test-module');
    });

    it('should allow different module names', () => {
      const reducer1 = new TestReducer(mockRegistry, 'module-1');
      const reducer2 = new TestReducer(mockRegistry, 'module-2');

      expect(reducer1['moduleName']).toBe('module-1');
      expect(reducer2['moduleName']).toBe('module-2');
    });
  });

  describe('getCollab', () => {
    const validRequestData: RequestData = {
      ip: '127.0.0.1',
      user_id: 'user-123',
      jwt: {},
      headers: {},
      project_id: 'project-456',
    };

    it('should get collab from registry with correct project_id', () => {
      const collab = reducer['getCollab'](validRequestData);

      expect(mockRegistry.getCollabForProject).toHaveBeenCalledWith(
        'project-456'
      );
      expect(collab).toBe(mockCollab);
    });

    it('should throw error when project_id is undefined', () => {
      const invalidRequestData: RequestData = {
        ...validRequestData,
        project_id: undefined,
      };

      expect(() => {
        reducer['getCollab'](invalidRequestData);
      }).toThrow('project_id is required for test-module reducer events');
    });

    it('should throw error when project_id is empty string', () => {
      const invalidRequestData: RequestData = {
        ...validRequestData,
        project_id: '',
      };

      expect(() => {
        reducer['getCollab'](invalidRequestData);
      }).toThrow('project_id is required for test-module reducer events');
    });

    it('should include module name in error message', () => {
      const customReducer = new TestReducer(mockRegistry, 'custom-module-name');
      const invalidRequestData: RequestData = {
        ...validRequestData,
        project_id: undefined,
      };

      expect(() => {
        customReducer['getCollab'](invalidRequestData);
      }).toThrow(
        'project_id is required for custom-module-name reducer events'
      );
    });

    it('should work with different project_ids', () => {
      const requestData1 = { ...validRequestData, project_id: 'project-1' };
      const requestData2 = { ...validRequestData, project_id: 'project-2' };

      reducer['getCollab'](requestData1);
      reducer['getCollab'](requestData2);

      expect(mockRegistry.getCollabForProject).toHaveBeenCalledWith(
        'project-1'
      );
      expect(mockRegistry.getCollabForProject).toHaveBeenCalledWith(
        'project-2'
      );
      expect(mockRegistry.getCollabForProject).toHaveBeenCalledTimes(2);
    });
  });

  describe('reduce method integration', () => {
    const requestData: RequestData = {
      ip: '127.0.0.1',
      user_id: 'user-123',
      jwt: {},
      headers: {},
      project_id: 'test-project',
    };

    it('should call getCollab when processing events', async () => {
      await reducer.reduce(
        { type: 'test:create', id: 'item-1', data: 'test-data' },
        requestData
      );

      expect(mockRegistry.getCollabForProject).toHaveBeenCalledWith(
        'test-project'
      );
    });

    it('should use correct collab instance in event handler', async () => {
      await reducer.reduce(
        { type: 'test:create', id: 'item-1', data: 'test-data' },
        requestData
      );

      expect(reducer.lastCollab).toBe(mockCollab);
    });

    it('should modify shared data through collab', async () => {
      await reducer.reduce(
        { type: 'test:create', id: 'item-1', data: 'test-data' },
        requestData
      );

      const items = mockCollab.sharedData['test:items'] as Map<string, string>;
      expect(items.get('item-1')).toBe('test-data');
    });

    it('should handle multiple events with same project_id', async () => {
      await reducer.reduce(
        { type: 'test:create', id: 'item-1', data: 'data-1' },
        requestData
      );
      await reducer.reduce(
        { type: 'test:create', id: 'item-2', data: 'data-2' },
        requestData
      );

      expect(mockRegistry.getCollabForProject).toHaveBeenCalledTimes(2);

      const items = mockCollab.sharedData['test:items'] as Map<string, string>;
      expect(items.get('item-1')).toBe('data-1');
      expect(items.get('item-2')).toBe('data-2');
    });

    it('should handle different event types', async () => {
      await reducer.reduce(
        { type: 'test:create', id: 'item-1', data: 'test' },
        requestData
      );
      await reducer.reduce(
        { type: 'test:update', id: 'item-1', value: 42 },
        requestData
      );

      expect(mockRegistry.getCollabForProject).toHaveBeenCalledTimes(2);
    });

    it('should throw error if project_id missing', async () => {
      const invalidRequestData = { ...requestData, project_id: undefined };

      await expect(
        reducer.reduce(
          { type: 'test:create', id: 'item-1', data: 'test' },
          invalidRequestData
        )
      ).rejects.toThrow('project_id is required');
    });
  });

  describe('project isolation', () => {
    it('should use different collab instances for different projects', async () => {
      const collab1 = {
        ...mockCollab,
        sharedData: { ...mockCollab.sharedData },
      };
      const collab2 = {
        ...mockCollab,
        sharedData: { ...mockCollab.sharedData },
      };

      mockRegistry.getCollabForProject
        .mockReturnValueOnce(collab1 as any)
        .mockReturnValueOnce(collab2 as any);

      const requestData1: RequestData = {
        ip: '127.0.0.1',
        user_id: 'user-1',
        jwt: {},
        headers: {},
        project_id: 'project-1',
      };

      const requestData2: RequestData = {
        ...requestData1,
        project_id: 'project-2',
      };

      await reducer.reduce(
        { type: 'test:create', id: 'item-1', data: 'from-project-1' },
        requestData1
      );
      await reducer.reduce(
        { type: 'test:create', id: 'item-1', data: 'from-project-2' },
        requestData2
      );

      expect(mockRegistry.getCollabForProject).toHaveBeenCalledWith(
        'project-1'
      );
      expect(mockRegistry.getCollabForProject).toHaveBeenCalledWith(
        'project-2'
      );
    });
  });

  describe('error handling', () => {
    const requestData: RequestData = {
      ip: '127.0.0.1',
      user_id: 'user-123',
      jwt: {},
      headers: {},
      project_id: 'test-project',
    };

    it('should propagate errors from registry', async () => {
      const registryError = new Error('Registry error');
      mockRegistry.getCollabForProject.mockImplementation(() => {
        throw registryError;
      });

      await expect(
        reducer.reduce(
          { type: 'test:create', id: 'item-1', data: 'test' },
          requestData
        )
      ).rejects.toThrow('Registry error');
    });

    it('should handle null/undefined in various fields', () => {
      const edgeCaseData: RequestData = {
        ip: '',
        user_id: '',
        jwt: null as any,
        headers: null as any,
        project_id: 'valid-project',
      };

      // Should not throw - only project_id matters
      expect(() => {
        reducer['getCollab'](edgeCaseData);
      }).not.toThrow();
    });
  });

  describe('type safety', () => {
    it('should enforce correct event types', async () => {
      const requestData: RequestData = {
        ip: '127.0.0.1',
        user_id: 'user-123',
        jwt: {},
        headers: {},
        project_id: 'test-project',
      };

      // TypeScript should enforce these at compile time
      await reducer.reduce(
        { type: 'test:create', id: 'item-1', data: 'test' },
        requestData
      );

      await reducer.reduce(
        { type: 'test:update', id: 'item-1', value: 42 },
        requestData
      );

      expect(mockRegistry.getCollabForProject).toHaveBeenCalledTimes(2);
    });
  });

  describe('inheritance', () => {
    it('should allow extending with custom methods', async () => {
      class ExtendedReducer extends ReducerWithCollab<
        TTestEvents,
        TTestSharedData
      > {
        public customMethodCalled = false;

        override async reduce(
          event: TTestEvents,
          requestData: RequestData
        ): Promise<void> {
          this.customMethod(requestData);
        }

        private customMethod(requestData: RequestData) {
          const collab = this.getCollab(requestData);
          this.customMethodCalled = true;
          expect(collab).toBeDefined();
        }
      }

      const extended = new ExtendedReducer(mockRegistry, 'extended-module');
      await extended.reduce(
        { type: 'test:create', id: 'item-1', data: 'test' },
        { ip: '', user_id: '', jwt: {}, headers: {}, project_id: 'test' }
      );

      expect(extended.customMethodCalled).toBe(true);
    });

    it('should support multiple inheritance levels', async () => {
      class MiddleReducer extends ReducerWithCollab<
        TTestEvents,
        TTestSharedData
      > {
        protected helper(requestData: RequestData) {
          return this.getCollab(requestData);
        }

        override async reduce(): Promise<void> {
          // Base implementation
        }
      }

      class FinalReducer extends MiddleReducer {
        override async reduce(
          event: TTestEvents,
          requestData: RequestData
        ): Promise<void> {
          const collab = this.helper(requestData);
          expect(collab).toBe(mockCollab);
        }
      }

      const final = new FinalReducer(mockRegistry, 'final-module');
      await final.reduce(
        { type: 'test:create', id: 'item-1', data: 'test' },
        { ip: '', user_id: '', jwt: {}, headers: {}, project_id: 'test' }
      );
    });
  });
});
