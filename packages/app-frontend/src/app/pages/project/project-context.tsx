import { ReactNode, useMemo, createContext, useContext, useRef, useEffect } from 'react';
import { InfoCircledIcon } from '@radix-ui/react-icons';
import { Link } from 'react-router-dom';

import {
  ButtonBase,
  paletteRandomColor,
  standardizeError,
  useAction,
} from '@holistix-forge/ui-base';
import {
  GanymedeApi,
  useApi,
  useCurrentUser,
  useMutationStartOrganization,
  useQueryProjectByName,
} from '@holistix-forge/frontend-data';
import { browserLog } from '@holistix-forge/frontend-data';
import { useModuleExports } from '@holistix-forge/module/frontend';

import { ProjectState, ProjectData, ProjectUser } from './project-types';
import { ProjectLoading, ProjectError } from './project-loading';
import { OrganizationContext } from '../organization/organization-context';

//
//
//

const projectContext = createContext<ProjectData | null>(null);

/**
 * ProjectDispatcherSync - Synchronizes project_id with the event dispatcher
 * 
 * This component ensures that all events dispatched from the frontend
 * include the current project_id, enabling project-specific event handling
 * on the backend.
 */
const ProjectDispatcherSync = ({ project_id }: { project_id: string }) => {
  const moduleExports = useModuleExports<{ reducers: { dispatcher: { setProjectId: (id: string) => void } } }>('ProjectDispatcherSync');
  const dispatcher = moduleExports.reducers.dispatcher;

  useEffect(() => {
    // Set the project_id on the dispatcher when it changes
    dispatcher.setProjectId(project_id);
    browserLog('debug', 'PROJECT_DISPATCHER_SYNC', 'project_id set', {
      data: { project_id },
    });

    return () => {
      // Optional: Clear project_id on unmount (if desired)
      // dispatcher.setProjectId('');
    };
  }, [project_id, dispatcher]);

  return null; // This component only manages side effects
};

//
//
//

const useProjectUser = () => {
  const { data: currentUserData, status: currentUserStatus } = useCurrentUser();
  const userRef = useRef<ProjectUser | null>(null);

  const username =
    currentUserStatus === 'success' && currentUserData.user.user_id
      ? currentUserData.user.username
      : 'anonymous';

  // Only update the ref if username changes
  if (!userRef.current || userRef.current.username !== username) {
    userRef.current = {
      username,
      color:
        username === 'anonymous'
          ? 'var(--c-gray-6)'
          : paletteRandomColor(username),
      user_id: currentUserData?.user.user_id || 'anonymous',
    };
  }

  return userRef.current;
};

//

const useProjectState = (
  ownerId: string,
  projectName: string,
  ganymedeApi: GanymedeApi
): ProjectState => {
  const { status: projectStatus, data: projectData } = useQueryProjectByName(
    ownerId,
    projectName
  );

  // Calculate final state
  const state = useMemo((): ProjectState => {
    // Initial loading state - waiting for project data
    if (projectStatus === 'pending') {
      return { status: 'loading', progress: 20 };
    }

    // Handle project data fetch error
    if (projectStatus === 'error') {
      return { status: 'error', error: 'Failed to get project data' };
    }

    // Ensure project data exists
    if (!projectData) {
      return { status: 'error', error: 'Project data not available' };
    }

    // API response is now a direct TApi_Project object (not { _0: ... })
    const project = projectData;

    try {
      // TODO: Fetch organization data to determine isOwner properly
      // For now, we'll set it to false - this should be determined from organization ownership
      const data: ProjectData = {
        project: project,
        organization_id: project.organization_id,
        isOwner: false,
      };

      return { status: 'ready', data };
    } catch (err) {
      const e = standardizeError(err);
      const unhelpfulErrorMessage = 'Failed to initialize project';
      return {
        status: 'error',
        error: e ? e.global || unhelpfulErrorMessage : unhelpfulErrorMessage,
      };
    }
  }, [projectStatus, projectData]);

  return state;
};

//

const StartProjectBox = ({ organization_id }: { organization_id: string }) => {
  const startOrganization = useMutationStartOrganization(organization_id);
  const action = useAction(
    () => startOrganization.mutateAsync(),
    [startOrganization]
  );

  return (
    <div className="flex flex-col items-center justify-center h-[calc(100vh-80px)]">
      <div className="flex items-center gap-2 text-slate-400">
        <InfoCircledIcon className="w-[38px] h-[38px]" />
        <p className="text-lg">
          The project is not started.
          <br /> Press start to continue.
        </p>
      </div>
      <div className="flex items-center gap-2 text-slate-400 mt-5">
        <ButtonBase {...action} text="Start" className="blue" />
      </div>
    </div>
  );
};

//

export const ProjectContext = ({
  ownerId,
  projectName,
  children,
}: {
  ownerId: string;
  projectName: string;
  children: ReactNode;
}) => {
  const { ganymedeApi } = useApi();
  const projectState = useProjectState(ownerId, projectName, ganymedeApi);
  const user = useProjectUser();

  browserLog('debug', 'PROJECT_CONTEXT', 'update', {
    data: { projectState, user },
  });

  if (user.username === 'anonymous') {
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

  switch (projectState.status) {
    case 'loading':
      return (
        <ProjectLoading
          message="Loading project..."
          progress={projectState.progress}
        />
      );

    case 'error':
      return <ProjectError message={projectState.error} />;

    case 'not_started':
      return <StartProjectBox organization_id={projectState.organization_id} />;

    case 'ready':
      return (
        <OrganizationContext
          organization_id={projectState.data.organization_id}
        >
          <projectContext.Provider value={projectState.data}>
            <ProjectDispatcherSync
              project_id={projectState.data.project.project_id}
            />
            {children}
          </projectContext.Provider>
        </OrganizationContext>
      );
  }
};

//
//
//

export const useProject = () => {
  const p = useContext(projectContext) as ProjectData;
  return p;
};
