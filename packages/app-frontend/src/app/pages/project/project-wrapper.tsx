import { ReactNode, useEffect, useMemo } from 'react';
import { useParams, Link } from 'react-router-dom';
import { InfoCircledIcon } from '@radix-ui/react-icons';

import { ButtonBase, useAction } from '@holistix-forge/ui-base';
import {
  useQueryProjectByName,
  ProjectProvider,
  ModuleDataProvider,
  useMutationStartOrganization,
  useCurrentUser,
} from '@holistix-forge/frontend-data';
import {
  CollabProjectProvider,
  useCollabProjectId,
} from '@holistix-forge/collab/frontend';
import { useDispatcher } from '@holistix-forge/reducers/frontend';

import { ProjectLoading, ProjectError } from './project-loading';
import { useModuleExports } from '@holistix-forge/module/frontend';

import { getAllModules } from '../../modules';

/**
 * Syncs the project_id from CollabProjectProvider into the dispatcher, and
 * into anything else built once at module load that needs to know which
 * project it is looking at.
 *
 * Must be rendered inside both CollabProjectProvider and ModuleDataProvider.
 */
const ProjectDispatcherSync = () => {
  const project_id = useCollabProjectId();
  const dispatcher = useDispatcher();
  const moduleExports = useModuleExports<{
    jupyter?: { jlsManager?: { setProjectId: (id: string) => void } };
  }>('ProjectDispatcherSync');

  useEffect(() => {
    dispatcher.setProjectId(project_id);
  }, [project_id, dispatcher]);

  // Jupyter's manager is constructed at module load, before any project
  // exists, and resolves its shared data per project like everything else
  // since the collab registry landed. Optional because the module is not
  // always loaded, and a missing module must not take the page down.
  useEffect(() => {
    moduleExports.jupyter?.jlsManager?.setProjectId(project_id);
  }, [project_id, moduleExports]);

  return null;
};

/**
 * StartOrganizationBox - UI for starting a stopped organization
 */
const StartOrganizationBox = ({
  organization_id,
}: {
  organization_id: string;
}) => {
  const startOrganization = useMutationStartOrganization(organization_id);
  const action = useAction(
    () => startOrganization.mutateAsync(),
    [startOrganization]
  );

  return (
    <div
      className="flex flex-col items-center justify-center"
      style={{ height: 'calc(100vh - 80px)' }}
    >
      <div
        className="flex flex-col items-center text-center"
        style={{ gap: '8px', color: 'var(--neutral-5)' }}
      >
        <InfoCircledIcon style={{ width: '38px', height: '38px' }} />
        <p style={{ fontSize: 'var(--font-size-lg)' }}>
          Organization has been shut down due to inactivity.
        </p>
        <p
          style={{
            fontSize: 'var(--font-size-sm)',
            color: 'var(--neutral-6)',
            marginTop: '8px',
          }}
        >
          Click the button below to allocate a gateway and start the
          organization.
        </p>
      </div>
      <div
        className="flex items-center"
        style={{ gap: '8px', color: 'var(--neutral-5)', marginTop: '20px' }}
      >
        <ButtonBase {...action} text="Start Organization" className="blue" />
      </div>
    </div>
  );
};

/**
 * ProjectWrapper - Lightweight wrapper for project pages
 *
 * This component:
 * 1. Waits for current user data to be available
 * 2. Fetches project data from API
 * 3. Handles loading/error UI states
 * 4. Provides ModuleDataProvider (loads modules + gateway) - from frontend-data
 * 5. Provides ProjectProvider (project data context) - from frontend-data
 * 6. Provides CollabProjectProvider (project_id for collab hooks) - from collab module
 *
 * All data infrastructure comes from frontend-data and collab module.
 * This is just UI orchestration.
 */
export const ProjectWrapper = ({ children }: { children: ReactNode }) => {
  const { owner, project_name } = useParams();

  // Wait for user data before rendering project
  // This ensures the collab config has the real user ID instead of guest fallback
  const { data: currentUserData, status: userStatus } = useCurrentUser();

  // Always call hooks in the same order (Rules of Hooks)
  // Fetch project data unconditionally, but it won't be used until user is authenticated
  const {
    data: project,
    status,
    error,
  } = useQueryProjectByName(owner || '', project_name || '');

  // Extract user info for ModuleDataProvider's collab config. Memoized, and
  // computed before the early returns below so the hook order stays fixed:
  // this object is a dependency of the memo that loads every frontend module,
  // and rebuilding it on each render reloaded them all — which handed the
  // whiteboard a new node component type and remounted every node.
  // Color is generated from the username hash in collab-config.ts.
  const user = currentUserData?.user;
  const user_id = user && 'user_id' in user ? user.user_id : null;
  const username =
    user && 'username' in user ? user.username || user.email : undefined;
  const userInfo = useMemo(
    () =>
      user_id
        ? { user_id, username: username || 'User' }
        : {
            user_id: '00000000-0000-0000-0000-000000000001',
            username: 'Guest User',
          },
    [user_id, username]
  );

  // Check for invalid URL first
  if (!owner || !project_name) {
    return <ProjectError message="Invalid project URL" />;
  }

  // Loading user data
  if (userStatus === 'pending') {
    return <ProjectLoading message="Loading user data..." progress={10} />;
  }

  // Check if user is authenticated
  if (userStatus === 'success' && !currentUserData?.user?.user_id) {
    return (
      <div
        className="flex flex-col items-center justify-center"
        style={{ height: 'calc(100vh - 80px)' }}
      >
        <InfoCircledIcon style={{ width: '38px', height: '38px' }} />
        <p style={{ fontSize: 'var(--font-size-lg)' }}>
          Please login first, then come back here
        </p>
        <p>&nbsp;</p>
        <p>
          <Link to={`/account/login`}>
            <ButtonBase className="login" text="Login" />
          </Link>
        </p>
      </div>
    );
  }

  // Loading project data
  if (status === 'pending') {
    return <ProjectLoading message="Loading project..." progress={30} />;
  }

  // Error state
  if (status === 'error') {
    return (
      <ProjectError message={error?.message || 'Failed to load project'} />
    );
  }

  // Project not found
  if (!project) {
    return <ProjectError message="Project not found" />;
  }

  // Success - render with data providers
  return (
    <ModuleDataProvider
      organization_id={project.organization_id}
      modules={getAllModules()}
      userInfo={userInfo}
      loadingUI={<ProjectLoading message="Loading modules..." progress={70} />}
      unavailableUI={(org_id) => (
        <StartOrganizationBox organization_id={org_id} />
      )}
    >
      <ProjectProvider
        project={project}
        organization_id={project.organization_id}
        isOwner={false} // TODO: Determine from organization ownership
      >
        <CollabProjectProvider project_id={project.project_id}>
          <ProjectDispatcherSync />
          {children}
        </CollabProjectProvider>
      </ProjectProvider>
    </ModuleDataProvider>
  );
};
