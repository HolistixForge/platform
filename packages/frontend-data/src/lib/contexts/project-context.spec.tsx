import { renderHook } from '@testing-library/react';
import { ProjectProvider, useProject, useProjectId } from './project-context';
import type { TApi_Project } from '@holistix-forge/types';

const mockProject: TApi_Project = {
  project_id: 'project-123',
  name: 'Test Project',
  organization_id: 'org-456',
  created: '2024-01-01T00:00:00Z',
  public: false,
};

describe('ProjectContext', () => {
  describe('useProject', () => {
    it('should provide project data when wrapped with ProjectProvider', () => {
      const { result } = renderHook(() => useProject(), {
        wrapper: ({ children }) => (
          <ProjectProvider
            project={mockProject}
            organization_id="org-456"
            isOwner={true}
          >
            {children}
          </ProjectProvider>
        ),
      });

      expect(result.current.project).toEqual(mockProject);
      expect(result.current.organization_id).toBe('org-456');
      expect(result.current.isOwner).toBe(true);
    });

    it('should throw error when used outside ProjectProvider', () => {
      // Suppress console.error for this test
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();

      expect(() => {
        renderHook(() => useProject());
      }).toThrow('useProject must be used within ProjectProvider');

      consoleSpy.mockRestore();
    });
  });

  describe('useProjectId', () => {
    it('should return project_id from context', () => {
      const { result } = renderHook(() => useProjectId(), {
        wrapper: ({ children }) => (
          <ProjectProvider
            project={mockProject}
            organization_id="org-456"
            isOwner={false}
          >
            {children}
          </ProjectProvider>
        ),
      });

      expect(result.current).toBe('project-123');
    });

    it('should throw error when used outside ProjectProvider', () => {
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();

      expect(() => {
        renderHook(() => useProjectId());
      }).toThrow('useProject must be used within ProjectProvider');

      consoleSpy.mockRestore();
    });
  });
});
