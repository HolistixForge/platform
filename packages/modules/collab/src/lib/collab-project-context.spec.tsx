import { renderHook } from '@testing-library/react';
import { ReactNode } from 'react';
import {
  CollabProjectProvider,
  useCollabProjectId,
} from './collab-project-context';

describe('CollabProjectContext', () => {
  describe('CollabProjectProvider', () => {
    it('should provide project_id to children', () => {
      const wrapper = ({ children }: { children: ReactNode }) => (
        <CollabProjectProvider project_id="test-project-123">
          {children}
        </CollabProjectProvider>
      );

      const { result } = renderHook(() => useCollabProjectId(), { wrapper });

      expect(result.current).toBe('test-project-123');
    });

    it('should handle different project_id values', () => {
      const projectIds = [
        'project-abc',
        'project-xyz',
        'org-123-project-456',
        'a'.repeat(100), // long ID
      ];

      projectIds.forEach((projectId) => {
        const wrapper = ({ children }: { children: ReactNode }) => (
          <CollabProjectProvider project_id={projectId}>
            {children}
          </CollabProjectProvider>
        );

        const { result } = renderHook(() => useCollabProjectId(), { wrapper });
        expect(result.current).toBe(projectId);
      });
    });

    it('should allow nested providers (inner wins)', () => {
      const wrapper = ({ children }: { children: ReactNode }) => (
        <CollabProjectProvider project_id="outer-project">
          <CollabProjectProvider project_id="inner-project">
            {children}
          </CollabProjectProvider>
        </CollabProjectProvider>
      );

      const { result } = renderHook(() => useCollabProjectId(), { wrapper });

      expect(result.current).toBe('inner-project');
    });
  });

  describe('useCollabProjectId', () => {
    it('should throw error when used outside provider', () => {
      // Suppress console.error for this test
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();

      expect(() => {
        renderHook(() => useCollabProjectId());
      }).toThrow(
        'useCollabProjectId must be used within CollabProjectProvider'
      );

      consoleSpy.mockRestore();
    });

    it('should throw error with helpful message', () => {
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();

      try {
        renderHook(() => useCollabProjectId());
        fail('Should have thrown an error');
      } catch (error) {
        expect((error as Error).message).toContain('CollabProjectProvider');
        expect((error as Error).message).toContain('project_id');
      }

      consoleSpy.mockRestore();
    });

    it('should return same value for multiple calls within same provider', () => {
      const wrapper = ({ children }: { children: ReactNode }) => (
        <CollabProjectProvider project_id="consistent-project">
          {children}
        </CollabProjectProvider>
      );

      const { result, rerender } = renderHook(() => useCollabProjectId(), {
        wrapper,
      });

      const firstValue = result.current;
      rerender();
      const secondValue = result.current;

      expect(firstValue).toBe('consistent-project');
      expect(secondValue).toBe('consistent-project');
      expect(firstValue).toBe(secondValue);
    });
  });

  describe('Provider updates', () => {
    it('should update when project_id prop changes', () => {
      let currentProjectId = 'initial-project';

      const DynamicWrapper = ({ children }: { children: ReactNode }) => (
        <CollabProjectProvider project_id={currentProjectId}>
          {children}
        </CollabProjectProvider>
      );

      const { result, rerender } = renderHook(() => useCollabProjectId(), {
        wrapper: DynamicWrapper,
      });

      expect(result.current).toBe('initial-project');

      // Change the project ID
      currentProjectId = 'updated-project';
      rerender();

      expect(result.current).toBe('updated-project');
    });
  });

  describe('Edge cases', () => {
    it('should handle empty string project_id', () => {
      const wrapper = ({ children }: { children: ReactNode }) => (
        <CollabProjectProvider project_id="">{children}</CollabProjectProvider>
      );

      const { result } = renderHook(() => useCollabProjectId(), { wrapper });

      expect(result.current).toBe('');
    });

    it('should handle special characters in project_id', () => {
      const specialId = 'project-@#$%^&*()_+-=[]{}|;:,.<>?';

      const wrapper = ({ children }: { children: ReactNode }) => (
        <CollabProjectProvider project_id={specialId}>
          {children}
        </CollabProjectProvider>
      );

      const { result } = renderHook(() => useCollabProjectId(), { wrapper });

      expect(result.current).toBe(specialId);
    });
  });
});
