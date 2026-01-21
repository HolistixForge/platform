import { ReactNode } from 'react';
import { useParams, Link } from 'react-router-dom';
import { InfoCircledIcon } from '@radix-ui/react-icons';

import { ButtonBase, useAction } from '@holistix-forge/ui-base';
import {
  useQueryProjectByName,
  ProjectProvider,
  ModuleDataProvider,
  useMutationStartOrganization,
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
 * 1. Fetches project data from API
 * 2. Handles loading/error UI states
 * 3. Provides ModuleDataProvider (loads modules + gateway) - from frontend-data
 * 4. Provides ProjectProvider (project data context) - from frontend-data
 * 5. Provides CollabProjectProvider (project_id for collab hooks) - from collab module
 * 
 * All data infrastructure comes from frontend-data and collab module.
 * This is just UI orchestration.
 */
export const ProjectWrapper = ({ children }: { children: ReactNode }) => {
  const { owner, project_name } = useParams();
  
  if (!owner || !project_name) {
    return <ProjectError message="Invalid project URL" />;
  }
  
  const { data: project, status, error } = useQueryProjectByName(
    owner,
    project_name
  );
  
  // Loading state
  if (status === 'pending') {
    return <ProjectLoading message="Loading project..." progress={20} />;
  }
  
  // Error state
  if (status === 'error') {
    return <ProjectError message={error?.message || 'Failed to load project'} />;
  }
  
  // Project not found
  if (!project) {
    return <ProjectError message="Project not found" />;
  }
  
  // Anonymous user check
  // TODO: Move this to a route guard or AuthContext
  
  // Success - render with data providers
  return (
    <ModuleDataProvider
      organization_id={project.organization_id}
      modules={getAllModules()}
      loadingUI={<ProjectLoading message="Loading modules..." progress={60} />}
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
