import { ReactNode } from 'react';
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
import { CollabProjectProvider } from '@holistix-forge/collab/frontend';

import { ProjectLoading, ProjectError } from './project-loading';
import { getAllModules } from '../../modules';

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
    <div className="flex flex-col items-center justify-center h-[calc(100vh-80px)]">
      <div className="flex flex-col items-center gap-2 text-slate-400 text-center">
        <InfoCircledIcon className="w-[38px] h-[38px]" />
        <p className="text-lg">
          Organization has been shut down due to inactivity.
        </p>
        <p className="text-sm text-slate-500 mt-2">
          Click the button below to allocate a gateway and start the
          organization.
        </p>
      </div>
      <div className="flex items-center gap-2 text-slate-400 mt-5">
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
  const { data: project, status, error } = useQueryProjectByName(
    owner || '',
    project_name || ''
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
      <div className="flex flex-col items-center justify-center h-[calc(100vh-80px)]">
        <InfoCircledIcon className="w-[38px] h-[38px]" />
        <p className="text-lg">Please login first, then come back here</p>
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
    return <ProjectError message={error?.message || 'Failed to load project'} />;
  }
  
  // Project not found
  if (!project) {
    return <ProjectError message="Project not found" />;
  }
  
  // Success - render with data providers
  // Extract user info from useCurrentUser to pass to ModuleDataProvider for collab config
  // At this point currentUserData is guaranteed to exist because we checked userStatus above
  // Color will be generated from username hash in collab-config.ts
  const userInfo = currentUserData?.user?.user_id ? {
    user_id: currentUserData.user.user_id,
    username: currentUserData.user.username || currentUserData.user.email || 'User',
  } : {
    user_id: '00000000-0000-0000-0000-000000000001',
    username: 'Guest User',
  };
  
  return (
    <ModuleDataProvider
      organization_id={project.organization_id}
      modules={getAllModules()}
      userInfo={userInfo}
      loadingUI={<ProjectLoading message="Loading modules..." progress={70} />}
      unavailableUI={(org_id) => <StartOrganizationBox organization_id={org_id} />}
    >
      <ProjectProvider
        project={project}
        organization_id={project.organization_id}
        isOwner={false} // TODO: Determine from organization ownership
      >
        <CollabProjectProvider project_id={project.project_id}>
          {children}
        </CollabProjectProvider>
      </ProjectProvider>
    </ModuleDataProvider>
  );
};
