import { render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import * as Tooltip from '@radix-ui/react-tooltip';
import { ProjectWrapper } from './project-wrapper';
import * as frontendData from '@holistix-forge/frontend-data';
import * as collabFrontend from '@holistix-forge/collab/frontend';

/**
 * These specs existed for months with no `test` target to run them, so they
 * were written against a ProjectWrapper that no longer exists — it has since
 * grown a user-loading gate in front of everything else. Same intent, checked
 * against the component as it is now.
 */

jest.mock('@holistix-forge/frontend-data', () => ({
  useCurrentUser: jest.fn(),
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
  useCollabProjectId: jest.fn(() => 'project-123'),
}));

jest.mock('@holistix-forge/reducers/frontend', () => ({
  useDispatcher: jest.fn(() => ({ setProjectId: jest.fn() })),
}));

jest.mock('../../modules', () => ({
  getAllModules: jest.fn(() => []),
}));

//

const mockProject = {
  project_id: 'project-123',
  project_name: 'testproject',
  organization_id: 'org-456',
  owner_id: 'user-789',
  created_at: '2026-01-01T00:00:00.000Z',
  updated_at: '2026-01-01T00:00:00.000Z',
};

const signedIn = () =>
  (frontendData.useCurrentUser as jest.Mock).mockReturnValue({
    data: { user: { user_id: 'user-789', username: 'tester' } },
    status: 'success',
  });

const projectIs = (result: Record<string, unknown>) =>
  (frontendData.useQueryProjectByName as jest.Mock).mockReturnValue(result);

const projectLoaded = () =>
  projectIs({ data: mockProject, status: 'success', error: null });

//

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
    signedIn();
  });

  /**
   * The providers ProjectWrapper is mounted under in the real app — app.tsx
   * wraps everything in Tooltip.Provider, and ButtonBase (used by the login
   * prompt and by StartOrganizationBox) is a Radix tooltip trigger, so without
   * it those branches throw where the running app is fine.
   */
  const Wrapped = ({
    initialRoute,
    path,
  }: {
    initialRoute: string;
    path: string;
  }) => (
    <QueryClientProvider client={queryClient}>
      <Tooltip.Provider>
        <MemoryRouter initialEntries={[initialRoute]}>
          <Routes>
            <Route
              path={path}
              element={
                <ProjectWrapper>
                  <div data-testid="test-content">Test Content</div>
                </ProjectWrapper>
              }
            />
          </Routes>
        </MemoryRouter>
      </Tooltip.Provider>
    </QueryClientProvider>
  );

  const renderProjectWrapper = (
    initialRoute = '/p/testowner/testproject',
    path = '/p/:owner/:project_name'
  ) => render(<Wrapped initialRoute={initialRoute} path={path} />);

  describe('Waiting for the user', () => {
    it('should show loading while the user is being fetched', () => {
      // Arrange
      (frontendData.useCurrentUser as jest.Mock).mockReturnValue({
        data: undefined,
        status: 'pending',
      });
      projectIs({ data: undefined, status: 'pending', error: null });

      // Act
      renderProjectWrapper();

      // Assert - the project is not rendered against a guest identity while the
      // real one is still on its way
      expect(screen.getByText(/Loading user data/i)).toBeInTheDocument();
    });

    it('should ask an anonymous visitor to log in', () => {
      // Arrange
      (frontendData.useCurrentUser as jest.Mock).mockReturnValue({
        data: { user: null },
        status: 'success',
      });
      projectLoaded();

      // Act
      renderProjectWrapper();

      // Assert
      expect(screen.getByText(/Please login first/i)).toBeInTheDocument();
      expect(frontendData.ModuleDataProvider).not.toHaveBeenCalled();
    });
  });

  describe('Loading and error states', () => {
    it('should show loading state while fetching project', () => {
      // Arrange
      projectIs({ data: undefined, status: 'pending', error: null });

      // Act
      renderProjectWrapper();

      // Assert
      expect(screen.getByText(/Loading project/i)).toBeInTheDocument();
    });

    it('should show the error when the project fetch fails', () => {
      // Arrange
      projectIs({
        data: undefined,
        status: 'error',
        error: new Error('Network error'),
      });

      // Act
      renderProjectWrapper();

      // Assert
      expect(screen.getByText(/Network error/i)).toBeInTheDocument();
    });

    it('should say so when the project does not exist', () => {
      // Arrange
      projectIs({ data: null, status: 'success', error: null });

      // Act
      renderProjectWrapper();

      // Assert
      expect(screen.getByText(/Project not found/i)).toBeInTheDocument();
    });

    it('should refuse a URL with no project in it', () => {
      // Arrange
      projectIs({ data: undefined, status: 'pending', error: null });

      // Act
      renderProjectWrapper('/p/', '/p/');

      // Assert
      expect(screen.getByText(/Invalid project URL/i)).toBeInTheDocument();
    });
  });

  describe('Context hierarchy', () => {
    beforeEach(() => projectLoaded());

    it('should render all three providers', () => {
      // Act
      renderProjectWrapper();

      // Assert
      expect(screen.getByTestId('module-data-provider')).toBeInTheDocument();
      expect(screen.getByTestId('project-provider')).toBeInTheDocument();
      expect(screen.getByTestId('collab-project-provider')).toBeInTheDocument();
    });

    it('should nest them in the order the inner hooks depend on', () => {
      // Act
      renderProjectWrapper();

      // Assert
      const moduleProvider = screen.getByTestId('module-data-provider');
      const projectProvider = screen.getByTestId('project-provider');
      const collabProvider = screen.getByTestId('collab-project-provider');
      const content = screen.getByTestId('test-content');

      expect(moduleProvider).toContainElement(projectProvider);
      expect(projectProvider).toContainElement(collabProvider);
      expect(collabProvider).toContainElement(content);
    });

    it('should give each provider the project it is scoped to', () => {
      // Act
      renderProjectWrapper();

      // Assert
      expect(frontendData.ModuleDataProvider).toHaveBeenCalledWith(
        expect.objectContaining({ organization_id: 'org-456' }),
        expect.anything()
      );
      expect(frontendData.ProjectProvider).toHaveBeenCalledWith(
        expect.objectContaining({
          project: mockProject,
          organization_id: 'org-456',
          isOwner: false,
        }),
        expect.anything()
      );
      expect(collabFrontend.CollabProjectProvider).toHaveBeenCalledWith(
        expect.objectContaining({ project_id: 'project-123' }),
        expect.anything()
      );
    });

    it('should render children inside all of them', () => {
      // Act
      renderProjectWrapper();

      // Assert
      expect(screen.getByText('Test Content')).toBeInTheDocument();
    });
  });

  describe('What ModuleDataProvider is handed', () => {
    beforeEach(() => projectLoaded());

    it('should pass the modules from getAllModules', () => {
      // Arrange
      const mockModules = [
        { module: { name: 'tabs' } },
        { module: { name: 'whiteboard' } },
      ];

      const { getAllModules } = require('../../modules');
      getAllModules.mockReturnValue(mockModules);

      // Act
      renderProjectWrapper();

      // Assert
      expect(frontendData.ModuleDataProvider).toHaveBeenCalledWith(
        expect.objectContaining({ modules: mockModules }),
        expect.anything()
      );
    });

    it('should identify the signed-in user rather than the guest fallback', () => {
      // Act
      renderProjectWrapper();

      // Assert
      expect(frontendData.ModuleDataProvider).toHaveBeenCalledWith(
        expect.objectContaining({
          userInfo: { user_id: 'user-789', username: 'tester' },
        }),
        expect.anything()
      );
    });

    it('should keep userInfo identical across re-renders', () => {
      // Arrange
      const { rerender } = renderProjectWrapper();

      // Act - a second render with nothing changed
      rerender(
        <Wrapped
          initialRoute="/p/testowner/testproject"
          path="/p/:owner/:project_name"
        />
      );

      // Assert - this object keys the memo that loads every frontend module. A
      // fresh one per render reloaded them all, which handed the whiteboard a
      // new node component type and remounted every node in the project; that
      // was TAC-126, and the useMemo in ProjectWrapper is what prevents it.
      const calls = (frontendData.ModuleDataProvider as jest.Mock).mock.calls;
      expect(calls.length).toBeGreaterThan(1);
      expect(calls[calls.length - 1][0].userInfo).toBe(calls[0][0].userInfo);
    });

    it('should supply its own loading and unavailable UI', () => {
      // Act
      renderProjectWrapper();

      // Assert
      const props = (frontendData.ModuleDataProvider as jest.Mock).mock
        .calls[0][0];
      expect(props.loadingUI).toBeDefined();
      expect(typeof props.unavailableUI).toBe('function');
    });
  });

  describe('URL parameters', () => {
    it('should look the project up by owner and name from the path', () => {
      // Arrange
      projectLoaded();

      // Act
      renderProjectWrapper('/p/myowner/myproject');

      // Assert
      expect(frontendData.useQueryProjectByName).toHaveBeenCalledWith(
        'myowner',
        'myproject'
      );
    });

    it('should receive a project name decoded by the router', () => {
      // Arrange
      projectLoaded();

      // Act
      renderProjectWrapper('/p/owner/my%20project');

      // Assert
      expect(frontendData.useQueryProjectByName).toHaveBeenCalledWith(
        'owner',
        'my project'
      );
    });
  });

  describe('Cleanup', () => {
    it('should unmount without throwing', () => {
      // Arrange
      projectLoaded();
      const { unmount } = renderProjectWrapper();

      // Act / Assert
      expect(() => unmount()).not.toThrow();
    });
  });
});
