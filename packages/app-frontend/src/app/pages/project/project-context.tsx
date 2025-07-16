import {
  ReactNode,
  useMemo,
  useState,
  createContext,
  useContext,
  useEffect,
  useRef,
  useCallback,
} from 'react';
import { InfoCircledIcon } from '@radix-ui/react-icons';
import { Link } from 'react-router-dom';

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
  FrontendDispatcher,
  CollaborativeContext,
} from '@monorepo/collab-engine';
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
): [ProjectState, () => void] => {
  //
  const {
    status: projectStatus,
    data: projectData,
    refetch: refetchProject,
  } = useQueryProjectByName(ownerId, projectName);

  const { data: currentUserData } = useCurrentUser();

  const [roomId, setRoomId] = useState<string | null | Error>(null);

  const onCollabError = useCallback(() => {
    // may be collab stoped or restarted, room id changed
    log(7, 'COLLAB', 'onCollabError');
    refetchProject();
    setRoomId(null);
  }, [refetchProject]);

  // Setup collab configuration and API
  const collabSetup = useMemo(() => {
    if (projectStatus === 'success' && projectData._0.gateway_hostname) {
      setRoomId(null);

      const { gateway_hostname, project_id } = projectData._0;
      const location = `/collab`;
      const collabConfig = {
        type: 'yjs' as const,
        ws_server: serverUrl({
          host: gateway_hostname,
          location,
          websocket: true,
        }),
        token: {
          get: () =>
            ganymedeApi._ts.get({ project_id })?.value?.token.access_token ||
            '',
          refresh: () => {
            /* Token refresh logic here if needed */
          },
        },
      };

      const reducer_server = serverUrl({
        host: gateway_hostname,
        location,
      });

      const eventApi = new EventApi(ganymedeApi, reducer_server, project_id);

      return {
        collabConfig,
        reducer_server,
        eventApi,
        project_id,
      };
    }
    return null;
  }, [projectStatus, projectData, ganymedeApi]);

  // Fetch room ID if not already fetched
  useEffect(() => {
    const fetchRoomId = async () => {
      if (collabSetup) {
        let attempts = 0;
        const maxAttempts = 3;
        const delay = 3000; // 3 seconds

        const tryFetch = async () => {
          try {
            const id = await collabSetup.eventApi.fetch({
              url: 'room-id',
              method: 'GET',
            });

            if (typeof id === 'string' && id !== '') {
              setRoomId(id);
              return true;
            } else {
              log(7, 'COLLAB', 'fetch room id invalid', id);
            }
            return false;
          } catch (error) {
            log(7, 'COLLAB', 'fetch room id error', error);
            return false;
          }
        };

        while (attempts < maxAttempts) {
          const success = await tryFetch();
          if (success) break;

          attempts++;
          if (attempts < maxAttempts) {
            await new Promise((resolve) => setTimeout(resolve, delay));
          }
        }

        if (attempts === maxAttempts) {
          setRoomId(new Error('Failed to fetch room ID after 3 attempts'));
        }
      }
    };

    if (!roomId && collabSetup) {
      fetchRoomId();
    }
  }, [collabSetup, roomId]);

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

    // Check if project is started
    if (!collabSetup) {
      if (projectStatus === 'success' && !projectData._0.gateway_hostname) {
        return { status: 'not_started', project_id: projectData._0.project_id };
      }
      // Loading project setup
      return { status: 'loading', progress: 40 };
    }

    // Wait for room ID
    if (!roomId) {
      return { status: 'loading', progress: 60 };
    }

    if (roomId instanceof Error) {
      console.error('Failed to fetch room ID:', roomId);
      return { status: 'error', error: 'failed to get collaborative space id' };
    }

    try {
      const dispatcher = new FrontendDispatcher(collabSetup.eventApi);
      const data: ProjectData = {
        project: projectData._0,
        collabConfig: collabSetup.collabConfig,
        gatewayFQDN: projectData._0.gateway_hostname as string,
        yjsDocId: roomId,
        dispatcher,
        isOwner: projectData._0.owner_id === currentUserData?.user.user_id,
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
  }, [
    projectStatus,
    projectData,
    collabSetup,
    roomId,
    currentUserData?.user.user_id,
  ]);

  return [state, onCollabError];
};

//

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
            progress={80}
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
