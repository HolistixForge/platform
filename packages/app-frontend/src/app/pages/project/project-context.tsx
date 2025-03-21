import { ReactNode, useMemo, useState, createContext, useContext } from 'react';
import { InfoCircledIcon } from '@radix-ui/react-icons';
import {
  ButtonBase,
  paletteRandomColor,
  standardizeError,
  useAction,
} from '@monorepo/ui-base';
import {
  GanymedeApi,
  useApi,
  useCurrentUser,
  useMutationStartProject,
  useQueryProjectByName,
} from '@monorepo/frontend-data';
import {
  BrowserDispatcher,
  CollaborativeContext,
} from '@monorepo/collab-engine';
import { makeYjsDocId } from '@monorepo/demiurge-types';
import { ApiFetch, serverUrl } from '@monorepo/api-fetch';
import { TMyfetchRequest } from '@monorepo/simple-types';
import { log } from '@monorepo/log';

import { getCollabChunks } from './model/collab-model-chunk';
import { ProjectState, ProjectData, ProjectUser } from './project-types';
import { ProjectLoading, ProjectError } from './project-loading';

//
//
//

const projectContext = createContext<ProjectData | null>(null);

//
//
//

const useProjectUser = () => {
  const { data: currentUserData, status: currentUserStatus } = useCurrentUser();

  return useMemo<ProjectUser>(() => {
    const username =
      currentUserStatus === 'success' && currentUserData.user.user_id
        ? currentUserData.user.username
        : 'anonymous';

    return {
      username,
      color:
        username === 'anonymous'
          ? 'var(--c-gray-6)'
          : paletteRandomColor(username),
    };
  }, [currentUserData, currentUserStatus]);
};

const useProjectState = (
  ownerId: string,
  projectName: string,
  ganymedeApi: GanymedeApi
): [ProjectState, () => void] => {
  const { status: projectStatus, data: projectData } = useQueryProjectByName(
    ownerId,
    projectName
  );
  const { data: currentUserData } = useCurrentUser();
  const [connectionErrorCount, setConnectionErrorCount] = useState(0);

  const onCollabError = () => {
    setConnectionErrorCount((prev) => {
      const newCount = prev + 1;
      return newCount;
    });
  };

  const state = useMemo((): ProjectState => {
    if (projectStatus === 'pending') {
      return { status: 'loading' };
    }

    if (projectStatus === 'error') {
      return { status: 'error', error: 'Failed to get project data' };
    }

    if (connectionErrorCount > 0) {
      return {
        status: 'error',
        error: `Connection error. Attempting to reconnect...`,
      };
    }

    const { gateway_hostname, project_id } = projectData._0;

    if (!gateway_hostname) {
      return { status: 'not_started', project_id };
    }

    try {
      const get = (): string => {
        const v = ganymedeApi._ts.get({ project_id });
        return v.value?.token.access_token || '';
      };
      const refresh = () => {
        // Token refresh logic here if needed
      };

      const location = `/collab`;
      const collabConfig = {
        type: 'yjs' as const,
        ws_server: serverUrl({
          host: gateway_hostname,
          location,
          websocket: true,
        }),
        token: { get, refresh },
      };

      const reducer_server = serverUrl({
        host: gateway_hostname,
        location,
      });

      const eventApi = new EventApi(ganymedeApi, reducer_server, project_id);
      const dispatcher = new BrowserDispatcher(eventApi);

      const data: ProjectData = {
        project: projectData._0,
        collabConfig,
        gatewayFQDN: gateway_hostname,
        yjsDocId: makeYjsDocId({ project_id }),
        dispatcher,
        isOwner: projectData._0.owner_id === currentUserData?.user.user_id,
      };

      return { status: 'ready', data };
    } catch (err) {
      const e = standardizeError(err);
      const unhelpfullErrorMessage = 'Failed to initialize project';
      return {
        status: 'error',
        error: e ? e.global || unhelpfullErrorMessage : unhelpfullErrorMessage,
      };
    }
  }, [
    connectionErrorCount,
    currentUserData?.user.user_id,
    ganymedeApi,
    projectData,
    projectStatus,
  ]);

  return [state, onCollabError];
};

const StartProjectBox = ({
  project_id,
  ownerId,
  projectName,
}: {
  project_id: string;
  ownerId: string;
  projectName: string;
}) => {
  const startProject = useMutationStartProject(
    project_id,
    ownerId,
    projectName
  );
  const action = useAction(() => startProject.mutateAsync(), [startProject]);

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
  const [projectState, onCollabError] = useProjectState(
    ownerId,
    projectName,
    ganymedeApi
  );
  const user = useProjectUser();

  const collabChunks = useMemo(() => {
    if (projectState.status === 'ready') {
      return getCollabChunks(ganymedeApi);
    }
    return null;
  }, [ganymedeApi, projectState]);

  log(7, 'COLLABORATIVE_CONTEXT', 'update', { projectState, user });

  switch (projectState.status) {
    case 'loading':
      return <ProjectLoading message="Loading project data..." progress={30} />;

    case 'error':
      return <ProjectError message={projectState.error} />;

    case 'not_started':
      return (
        <StartProjectBox
          project_id={projectState.project_id}
          ownerId={ownerId}
          projectName={projectName}
        />
      );

    case 'ready':
      if (!collabChunks) {
        return (
          <ProjectLoading
            message="Initializing collaboration..."
            progress={60}
          />
        );
      }

      return (
        <projectContext.Provider value={projectState.data}>
          <CollaborativeContext
            id={projectState.data.yjsDocId}
            collabChunks={collabChunks}
            user={user}
            config={projectState.data.collabConfig}
            dispatcher={projectState.data.dispatcher}
            onError={onCollabError}
          >
            {children}
          </CollaborativeContext>
        </projectContext.Provider>
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

//
//
//

class EventApi extends ApiFetch {
  /**
   *
   */
  _ganymedeApi: GanymedeApi;
  _project_id: string;

  constructor(ga: GanymedeApi, host: string, project_id: string) {
    super();
    this._ganymedeApi = ga;
    this._host = host;
    this._project_id = project_id;
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  override async fetch(r: TMyfetchRequest): Promise<any> {
    // we inject a fake 'project_id' path parameter so that the
    // relevant token will be sent by _ganymedeApi
    if (!r.pathParameters) r.pathParameters = {};
    r.pathParameters['project_id'] = this._project_id;
    return this._ganymedeApi.fetch(r, this._host);
  }
}
