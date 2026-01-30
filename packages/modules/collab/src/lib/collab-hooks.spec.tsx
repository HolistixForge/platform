import { renderHook, act } from '@testing-library/react';
import { ReactNode } from 'react';
import { ModuleProvider } from '@holistix-forge/module/frontend';
import { CollabProjectProvider } from './collab-project-context';
import {
  useLocalSharedData,
  useLocalSharedDataManager,
  useAwareness,
  useAwarenessUserList,
  useAwarenessSelections,
  useBindEditor,
  useSharedDataDirect,
} from './collab-hooks';

// Mock ModuleProvider to properly provide exports
jest.mock('@holistix-forge/module/frontend', () => ({
  ModuleProvider: ({ children, modules }: any) => {
    // Store modules in a way that useModuleExports can access
    (global as any).__mockModules = modules;
    return <>{children}</>;
  },
  useModuleExports: () => {
    return (global as any).__mockModules || {};
  },
}));

describe('Collab Hooks with CollabProjectProvider', () => {
  // Mock collab instance
  const createMockCollab = () => ({
    awareness: {
      getUserList: jest.fn(() => [
        { user_id: 'user1', username: 'Alice', color: '#ff0000' },
        { user_id: 'user2', username: 'Bob', color: '#00ff00' },
      ]),
      getSelectionTracking: jest.fn(() => ({
        'node-1': [{ user_id: 'user1', username: 'Alice' }],
      })),
      addUserListListener: jest.fn(),
      removeUserListListener: jest.fn(),
      addSelectionListener: jest.fn(),
      removeSelectionListener: jest.fn(),
    },
    sharedData: {
      'tabs:tabs': new Map([['unique', { tree: { children: [] } }]]),
      'whiteboard:views': new Map([['view-1', { name: 'View 1' }]]),
    },
    sharedEditor: {},
  });

  // Mock local overrider
  const createMockLocalOverrider = () => ({
    observe: jest.fn(),
    unobserve: jest.fn(),
    getData: jest.fn(() => ({
      'tabs:tabs': new Map([['unique', { tree: { children: [] } }]]),
      'whiteboard:views': new Map([['view-1', { name: 'View 1' }]]),
    })),
  });

  // Create wrapper with mocked module exports
  const createWrapper = (projectId = 'test-project-123') => {
    const mockCollab = createMockCollab();
    const mockLocalOverrider = createMockLocalOverrider();

    const getCollabForProject = jest.fn((project_id: string) => ({
      collab: mockCollab,
      localOverrider: mockLocalOverrider,
    }));

    const mockModuleExports = {
      collab: { getCollabForProject },
    };

    const Wrapper = ({ children }: { children: ReactNode }) => (
      <ModuleProvider exports={mockModuleExports}>
        <CollabProjectProvider project_id={projectId}>
          {children}
        </CollabProjectProvider>
      </ModuleProvider>
    );

    return {
      Wrapper,
      mocks: {
        collab: mockCollab,
        localOverrider: mockLocalOverrider,
        getCollabForProject,
      },
    };
  };

  describe('useLocalSharedData', () => {
    it('should get project_id from CollabProjectContext', () => {
      const { Wrapper, mocks } = createWrapper('project-abc');

      renderHook(
        () => useLocalSharedData(['tabs:tabs'], (d) => d['tabs:tabs']),
        { wrapper: Wrapper }
      );

      expect(mocks.getCollabForProject).toHaveBeenCalledWith('project-abc');
    });

    it('should call observe on localOverrider', () => {
      const { Wrapper, mocks } = createWrapper();

      renderHook(
        () => useLocalSharedData(['tabs:tabs'], (d) => d['tabs:tabs']),
        { wrapper: Wrapper }
      );

      expect(mocks.localOverrider.observe).toHaveBeenCalledWith(
        ['tabs:tabs'],
        expect.any(Function)
      );
    });

    it('should call unobserve on cleanup', () => {
      const { Wrapper, mocks } = createWrapper();

      const { unmount } = renderHook(
        () => useLocalSharedData(['tabs:tabs'], (d) => d['tabs:tabs']),
        { wrapper: Wrapper }
      );

      unmount();

      expect(mocks.localOverrider.unobserve).toHaveBeenCalledWith(
        ['tabs:tabs'],
        expect.any(Function)
      );
    });

    it('should return data from extraction function', () => {
      const { Wrapper } = createWrapper();

      const { result } = renderHook(
        () =>
          useLocalSharedData(['tabs:tabs'], (d) =>
            d['tabs:tabs'].get('unique')
          ),
        { wrapper: Wrapper }
      );

      expect(result.current).toEqual({ tree: { children: [] } });
    });

    it('should observe multiple keys', () => {
      const { Wrapper, mocks } = createWrapper();

      renderHook(
        () =>
          useLocalSharedData(['tabs:tabs', 'whiteboard:views'], (d) => ({
            tabs: d['tabs:tabs'],
            views: d['whiteboard:views'],
          })),
        { wrapper: Wrapper }
      );

      expect(mocks.localOverrider.observe).toHaveBeenCalledWith(
        ['tabs:tabs', 'whiteboard:views'],
        expect.any(Function)
      );
    });

    it('should throw error when used without CollabProjectProvider', () => {
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();

      const mockModuleExports = {
        collab: { getCollabForProject: jest.fn() },
      };

      const BadWrapper = ({ children }: { children: ReactNode }) => (
        <ModuleProvider exports={mockModuleExports}>{children}</ModuleProvider>
      );

      expect(() => {
        renderHook(
          () => useLocalSharedData(['tabs:tabs'], (d) => d['tabs:tabs']),
          { wrapper: BadWrapper }
        );
      }).toThrow(
        'useCollabProjectId must be used within CollabProjectProvider'
      );

      consoleSpy.mockRestore();
    });
  });

  describe('useLocalSharedDataManager', () => {
    it('should return localOverrider for current project', () => {
      const { Wrapper, mocks } = createWrapper('project-xyz');

      const { result } = renderHook(() => useLocalSharedDataManager(), {
        wrapper: Wrapper,
      });

      expect(result.current).toBe(mocks.localOverrider);
      expect(mocks.getCollabForProject).toHaveBeenCalledWith('project-xyz');
    });
  });

  describe('useAwareness', () => {
    it('should return awareness instance for current project', () => {
      const { Wrapper, mocks } = createWrapper('project-123');

      const { result } = renderHook(() => useAwareness(), { wrapper: Wrapper });

      expect(result.current.awareness).toBe(mocks.collab.awareness);
      expect(mocks.getCollabForProject).toHaveBeenCalledWith('project-123');
    });
  });

  describe('useAwarenessUserList', () => {
    it('should return list of active users', () => {
      const { Wrapper, mocks } = createWrapper();

      const { result } = renderHook(() => useAwarenessUserList(), {
        wrapper: Wrapper,
      });

      expect(result.current).toEqual([
        { user_id: 'user1', username: 'Alice', color: '#ff0000' },
        { user_id: 'user2', username: 'Bob', color: '#00ff00' },
      ]);
      expect(mocks.collab.awareness.getUserList).toHaveBeenCalled();
    });

    it('should add listener on mount', () => {
      const { Wrapper, mocks } = createWrapper();

      renderHook(() => useAwarenessUserList(), { wrapper: Wrapper });

      expect(mocks.collab.awareness.addUserListListener).toHaveBeenCalledWith(
        expect.any(Function)
      );
    });

    it('should remove listener on unmount', () => {
      const { Wrapper, mocks } = createWrapper();

      const { unmount } = renderHook(() => useAwarenessUserList(), {
        wrapper: Wrapper,
      });

      unmount();

      expect(
        mocks.collab.awareness.removeUserListListener
      ).toHaveBeenCalledWith(expect.any(Function));
    });

    it('should update when users change', () => {
      const { Wrapper, mocks } = createWrapper();

      let listener: (() => void) | null = null;
      mocks.collab.awareness.addUserListListener.mockImplementation((cb) => {
        listener = cb;
      });

      const { result } = renderHook(() => useAwarenessUserList(), {
        wrapper: Wrapper,
      });

      // Initial state
      expect(result.current).toEqual([
        { user_id: 'user1', username: 'Alice', color: '#ff0000' },
        { user_id: 'user2', username: 'Bob', color: '#00ff00' },
      ]);

      // Simulate user list change
      mocks.collab.awareness.getUserList.mockReturnValue([
        { user_id: 'user1', username: 'Alice', color: '#ff0000' },
        { user_id: 'user2', username: 'Bob', color: '#00ff00' },
        { user_id: 'user3', username: 'Charlie', color: '#0000ff' },
      ]);

      act(() => {
        listener!();
      });

      expect(result.current).toEqual([
        { user_id: 'user1', username: 'Alice', color: '#ff0000' },
        { user_id: 'user2', username: 'Bob', color: '#00ff00' },
        { user_id: 'user3', username: 'Charlie', color: '#0000ff' },
      ]);
    });
  });

  describe('useAwarenessSelections', () => {
    it('should return selection tracking', () => {
      const { Wrapper } = createWrapper();

      const { result } = renderHook(() => useAwarenessSelections(), {
        wrapper: Wrapper,
      });

      expect(result.current).toEqual({
        'node-1': [{ user_id: 'user1', username: 'Alice' }],
      });
    });

    it('should add and remove selection listener', () => {
      const { Wrapper, mocks } = createWrapper();

      const { unmount } = renderHook(() => useAwarenessSelections(), {
        wrapper: Wrapper,
      });

      expect(mocks.collab.awareness.addSelectionListener).toHaveBeenCalledWith(
        expect.any(Function)
      );

      unmount();

      expect(
        mocks.collab.awareness.removeSelectionListener
      ).toHaveBeenCalledWith(expect.any(Function));
    });
  });

  describe('useBindEditor', () => {
    it('should return bind function', () => {
      const { Wrapper } = createWrapper();

      const { result } = renderHook(() => useBindEditor(), {
        wrapper: Wrapper,
      });

      expect(result.current).toBeInstanceOf(Function);
    });

    it('should use awareness and sharedEditor from current project', () => {
      const { Wrapper, mocks } = createWrapper('project-editor');

      renderHook(() => useBindEditor(), { wrapper: Wrapper });

      expect(mocks.getCollabForProject).toHaveBeenCalledWith('project-editor');
    });
  });

  describe('useSharedDataDirect', () => {
    it('should return shared data object', () => {
      const { Wrapper, mocks } = createWrapper();

      const { result } = renderHook(() => useSharedDataDirect(), {
        wrapper: Wrapper,
      });

      expect(result.current).toBe(mocks.collab.sharedData);
    });

    it('should get data for correct project', () => {
      const { Wrapper, mocks } = createWrapper('project-direct');

      renderHook(() => useSharedDataDirect(), { wrapper: Wrapper });

      expect(mocks.getCollabForProject).toHaveBeenCalledWith('project-direct');
    });
  });

  describe('Multiple projects isolation', () => {
    it('should call getCollabForProject with different project_id for different contexts', () => {
      const mockCollab1 = createMockCollab();
      const mockCollab2 = createMockCollab();
      const mockOverrider1 = createMockLocalOverrider();
      const mockOverrider2 = createMockLocalOverrider();

      const getCollabForProject = jest.fn((project_id: string) => {
        if (project_id === 'project-1') {
          return { collab: mockCollab1, localOverrider: mockOverrider1 };
        } else {
          return { collab: mockCollab2, localOverrider: mockOverrider2 };
        }
      });

      const mockModuleExports = { collab: { getCollabForProject } };

      const Wrapper1 = ({ children }: { children: ReactNode }) => (
        <ModuleProvider exports={mockModuleExports}>
          <CollabProjectProvider project_id="project-1">
            {children}
          </CollabProjectProvider>
        </ModuleProvider>
      );

      const Wrapper2 = ({ children }: { children: ReactNode }) => (
        <ModuleProvider exports={mockModuleExports}>
          <CollabProjectProvider project_id="project-2">
            {children}
          </CollabProjectProvider>
        </ModuleProvider>
      );

      renderHook(
        () => useLocalSharedData(['tabs:tabs'], (d) => d['tabs:tabs']),
        { wrapper: Wrapper1 }
      );

      renderHook(
        () => useLocalSharedData(['tabs:tabs'], (d) => d['tabs:tabs']),
        { wrapper: Wrapper2 }
      );

      expect(getCollabForProject).toHaveBeenCalledWith('project-1');
      expect(getCollabForProject).toHaveBeenCalledWith('project-2');
      expect(getCollabForProject).toHaveBeenCalledTimes(2);
    });
  });
});
