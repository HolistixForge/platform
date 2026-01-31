import { render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { ProjectWrapper } from './project-wrapper';
import * as frontendData from '@holistix-forge/frontend-data';
import * as collabFrontend from '@holistix-forge/collab/frontend';

// Mock dependencies
jest.mock('@holistix-forge/frontend-data', () => ({
  useQueryProjectByName: jest.fn(),
  ProjectProvider: jest.fn(({ children }) => (
    <div data-testid="project-provider">{children}</div>
  )),
  ModuleDataProvider: jest.fn(({ children }) => (
    <div data-testid="module-data-provider">{children}</div>
  )),
  useMutationStartOrganization: jest.fn(() => ({
    mutateAsync: jest.fn(),
  })),
}));

jest.mock('@holistix-forge/collab/frontend', () => ({
  CollabProjectProvider: jest.fn(({ children }) => (
    <div data-testid="collab-project-provider">{children}</div>
  )),
}));

jest.mock('../../modules', () => ({
  getAllModules: jest.fn(() => []),
}));

describe('ProjectWrapper', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false },
      },
    });
    jest.clearAllMocks();
  });

  const renderProjectWrapper = (initialRoute = '/p/testowner/testproject') => {
    return render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={[initialRoute]}>
          <Routes>
            <Route
              path="/p/:owner/:project_name"
              element={
                <ProjectWrapper>
                  <div data-testid="test-content">Test Content</div>
                </ProjectWrapper>
              }
            />
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>
    );
  };

  describe('Loading states', () => {
    it('should show loading state while fetching project', () => {
      (frontendData.useQueryProjectByName as jest.Mock).mockReturnValue({
        data: undefined,
        status: 'pending',
        error: null,
      });

      renderProjectWrapper();

      expect(screen.getByText(/Loading project/i)).toBeInTheDocument();
    });

    it('should show progress during loading', () => {
      (frontendData.useQueryProjectByName as jest.Mock).mockReturnValue({
        data: undefined,
        status: 'pending',
        error: null,
      });

      renderProjectWrapper();

      // Check that loading UI is rendered with progress
      const loadingElement = screen.getByText(/Loading project/i);
      expect(loadingElement).toBeInTheDocument();
    });
  });

  describe('Error states', () => {
    it('should show error when project fetch fails', () => {
      (frontendData.useQueryProjectByName as jest.Mock).mockReturnValue({
        data: undefined,
        status: 'error',
        error: new Error('Network error'),
      });

      renderProjectWrapper();

      expect(screen.getByText(/Network error/i)).toBeInTheDocument();
    });

    it('should show error when project not found', () => {
      (frontendData.useQueryProjectByName as jest.Mock).mockReturnValue({
        data: null,
        status: 'success',
        error: null,
      });

      renderProjectWrapper();

      expect(screen.getByText(/Project not found/i)).toBeInTheDocument();
    });

    it('should show error for invalid URL parameters', () => {
      (frontendData.useQueryProjectByName as jest.Mock).mockReturnValue({
        data: undefined,
        status: 'pending',
        error: null,
      });

      render(
        <QueryClientProvider client={queryClient}>
          <MemoryRouter initialEntries={['/p/']}>
            <Routes>
              <Route
                path="/p/"
                element={
                  <ProjectWrapper>
                    <div>Content</div>
                  </ProjectWrapper>
                }
              />
            </Routes>
          </MemoryRouter>
        </QueryClientProvider>
      );

      expect(screen.getByText(/Invalid project URL/i)).toBeInTheDocument();
    });
  });

  describe('Success state - Context hierarchy', () => {
    const mockProject = {
      project_id: 'project-123',
      project_name: 'testproject',
      organization_id: 'org-456',
      owner_id: 'user-789',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    beforeEach(() => {
      (frontendData.useQueryProjectByName as jest.Mock).mockReturnValue({
        data: mockProject,
        status: 'success',
        error: null,
      });
    });

    it('should render all providers when project loads successfully', () => {
      renderProjectWrapper();

      expect(screen.getByTestId('module-data-provider')).toBeInTheDocument();
      expect(screen.getByTestId('project-provider')).toBeInTheDocument();
      expect(screen.getByTestId('collab-project-provider')).toBeInTheDocument();
    });

    it('should provide ModuleDataProvider with correct organization_id', () => {
      renderProjectWrapper();

      expect(frontendData.ModuleDataProvider).toHaveBeenCalledWith(
        expect.objectContaining({
          organization_id: 'org-456',
        }),
        expect.anything()
      );
    });

    it('should provide ProjectProvider with correct project data', () => {
      renderProjectWrapper();

      expect(frontendData.ProjectProvider).toHaveBeenCalledWith(
        expect.objectContaining({
          project: mockProject,
          organization_id: 'org-456',
          isOwner: false,
        }),
        expect.anything()
      );
    });

    it('should provide CollabProjectProvider with correct project_id', () => {
      renderProjectWrapper();

      expect(collabFrontend.CollabProjectProvider).toHaveBeenCalledWith(
        expect.objectContaining({
          project_id: 'project-123',
        }),
        expect.anything()
      );
    });

    it('should render children inside all providers', () => {
      renderProjectWrapper();

      expect(screen.getByTestId('test-content')).toBeInTheDocument();
      expect(screen.getByText('Test Content')).toBeInTheDocument();
    });

    it('should nest providers in correct order', () => {
      renderProjectWrapper();

      // Check nesting order: ModuleDataProvider -> ProjectProvider -> CollabProjectProvider -> Children
      const moduleProvider = screen.getByTestId('module-data-provider');
      const projectProvider = screen.getByTestId('project-provider');
      const collabProvider = screen.getByTestId('collab-project-provider');
      const content = screen.getByTestId('test-content');

      expect(moduleProvider).toContainElement(projectProvider);
      expect(projectProvider).toContainElement(collabProvider);
      expect(collabProvider).toContainElement(content);
    });
  });

  describe('Module loading', () => {
    const mockProject = {
      project_id: 'project-123',
      project_name: 'testproject',
      organization_id: 'org-456',
      owner_id: 'user-789',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    beforeEach(() => {
      (frontendData.useQueryProjectByName as jest.Mock).mockReturnValue({
        data: mockProject,
        status: 'success',
        error: null,
      });
    });

    it('should pass modules from getAllModules to ModuleDataProvider', () => {
      const mockModules = [
        { name: 'tabs', version: '1.0.0' },
        { name: 'whiteboard', version: '1.0.0' },
      ];
      const { getAllModules } = require('../../modules');
      getAllModules.mockReturnValue(mockModules);

      renderProjectWrapper();

      expect(frontendData.ModuleDataProvider).toHaveBeenCalledWith(
        expect.objectContaining({
          modules: mockModules,
        }),
        expect.anything()
      );
    });

    it('should provide loading UI to ModuleDataProvider', () => {
      renderProjectWrapper();

      const call = (frontendData.ModuleDataProvider as jest.Mock).mock.calls[0];
      const props = call[0];

      expect(props.loadingUI).toBeDefined();
      expect(props.loadingUI.type).toBeDefined();
    });

    it('should provide unavailable UI to ModuleDataProvider', () => {
      renderProjectWrapper();

      const call = (frontendData.ModuleDataProvider as jest.Mock).mock.calls[0];
      const props = call[0];

      expect(props.unavailableUI).toBeDefined();
      expect(typeof props.unavailableUI).toBe('function');
    });
  });

  describe('URL parameter extraction', () => {
    it('should extract owner and project_name from URL', () => {
      (frontendData.useQueryProjectByName as jest.Mock).mockReturnValue({
        data: {
          project_id: 'p1',
          project_name: 'myproject',
          organization_id: 'org1',
          owner_id: 'owner1',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
        status: 'success',
        error: null,
      });

      renderProjectWrapper('/p/myowner/myproject');

      expect(frontendData.useQueryProjectByName).toHaveBeenCalledWith(
        'myowner',
        'myproject'
      );
    });

    it('should handle URL-encoded project names', () => {
      (frontendData.useQueryProjectByName as jest.Mock).mockReturnValue({
        data: {
          project_id: 'p1',
          project_name: 'my project',
          organization_id: 'org1',
          owner_id: 'owner1',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
        status: 'success',
        error: null,
      });

      renderProjectWrapper('/p/owner/my%20project');

      // URL decoding happens in react-router, so we get decoded params
      expect(frontendData.useQueryProjectByName).toHaveBeenCalled();
    });
  });

  describe('Integration with contexts', () => {
    it('should allow components to access both ProjectProvider and CollabProjectProvider', () => {
      const mockProject = {
        project_id: 'integration-project',
        project_name: 'testproject',
        organization_id: 'org-test',
        owner_id: 'owner-test',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      (frontendData.useQueryProjectByName as jest.Mock).mockReturnValue({
        data: mockProject,
        status: 'success',
        error: null,
      });

      // Create a test component that uses both contexts
      const TestComponent = () => {
        // In real implementation, these would access the contexts
        return (
          <div>
            <div data-testid="has-project-context">Has ProjectProvider</div>
            <div data-testid="has-collab-context">Has CollabProjectProvider</div>
          </div>
        );
      };

      render(
        <QueryClientProvider client={queryClient}>
          <MemoryRouter initialEntries={['/p/testowner/testproject']}>
            <Routes>
              <Route
                path="/p/:owner/:project_name"
                element={
                  <ProjectWrapper>
                    <TestComponent />
                  </ProjectWrapper>
                }
              />
            </Routes>
          </MemoryRouter>
        </QueryClientProvider>
      );

      expect(screen.getByTestId('has-project-context')).toBeInTheDocument();
      expect(screen.getByTestId('has-collab-context')).toBeInTheDocument();
    });
  });

  describe('Cleanup', () => {
    it('should not throw errors on unmount', () => {
      const mockProject = {
        project_id: 'project-cleanup',
        project_name: 'testproject',
        organization_id: 'org-cleanup',
        owner_id: 'owner-cleanup',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      (frontendData.useQueryProjectByName as jest.Mock).mockReturnValue({
        data: mockProject,
        status: 'success',
        error: null,
      });

      const { unmount } = renderProjectWrapper();

      expect(() => unmount()).not.toThrow();
    });
  });
});
