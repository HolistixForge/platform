import { useMemo, useState, createContext, useContext, ReactNode } from 'react';
import { InfoCircledIcon } from '@radix-ui/react-icons';

import {
  ButtonBase,
  paletteRandomColor,
  standardizeError,
  useAction,
} from '@monorepo/demiurge-ui-components';
import {
  GanymedeApi,
  useApi,
  useCurrentUser,
  useMutationStartProject,
  useQueryProjectByName,
} from '@monorepo/frontend-data';
import {
  CollaborativeContext,
  TYjsCollabConfig,
} from '@monorepo/collab-engine';
import { TApi_Project, makeYjsDocId } from '@monorepo/demiurge-types';
import { ApiFetch, serverUrl } from '@monorepo/api-fetch';
import { TMyfetchRequest } from '@monorepo/simple-types';
import { log } from '@monorepo/log';
import { getCollabChunks } from '../../../model/collab-model-chunk';

//
//
//

type TProjectContext = Readonly<{
  project: TApi_Project;
  collabConfig: TYjsCollabConfig;
  yjsDocId: string;
  eventApi: EventApi;
  isOwner: boolean;
  gatewayFQDN: string;
}>;

//

const projectContext = createContext<TProjectContext | null>(null);

//
//
//

export const Project = ({
  ownerId,
  projectName,
  children,
}: {
  ownerId: string;
  projectName: string;
  children: ReactNode;
}) => {
  const { data: currentUserData, status: currentUserStatus } = useCurrentUser();
  const { ganymedeApi } = useApi();

  const [message, setMessage] = useState(
    "getting project's collaboration server informations"
  );

  //

  const username =
    currentUserStatus === 'success' && currentUserData.user.user_id
      ? currentUserData.user.username
      : undefined;

  const user = useMemo(() => {
    if (username)
      return {
        username,
        color: paletteRandomColor(username),
      };
    else
      return {
        username: 'anonymous',
        color: 'var(--c-gray-6)',
      };
  }, [username]);

  //
  //

  const { status: projectStatus, data: projectData } = useQueryProjectByName(
    ownerId,
    projectName
  );

  //

  const project = useMemo<Omit<TProjectContext, 'isOwner'> | null>(() => {
    if (projectStatus !== 'success') return null;

    const { gateway_hostname, project_id } = projectData._0;

    if (!gateway_hostname) return null;

    try {
      const get = (): string => {
        const v = ganymedeApi._ts.get({ project_id: project_id });
        return v.value?.token.access_token || '';
      };
      const refresh = () => {
        //
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

      return {
        project: projectData._0,
        collabConfig,
        gatewayFQDN: gateway_hostname,
        yjsDocId: makeYjsDocId({ project_id: project_id }),
        eventApi,
      };
    } catch (err) {
      const e = standardizeError(err);
      e && setMessage(e.global || '');
      return null;
    }
  }, [ganymedeApi, projectData, projectStatus]);

  //
  //

  const collabChunks = useMemo(() => {
    if (project) {
      return getCollabChunks({
        api: ganymedeApi,
        gatewayFQDN: project.gatewayFQDN,
        user,
      });
    }
    return null;
  }, [ganymedeApi, project, user]);

  //
  //

  log(7, 'COLLABORATIVE_CONTEXT', 'update', {
    project,
    username,
    currentUserStatus,
    currentUserData,
  });

  if (projectStatus === 'pending') {
    return <p>Getting project's data</p>;
  } else if (projectStatus === 'error') {
    return <p>Failed to get project's data</p>;
  } else if (!projectData._0.gateway_hostname) {
    return (
      <StartProjectBox
        project_id={projectData._0.project_id}
        ownerId={ownerId}
        projectName={projectName}
      />
    );
  } else if (project && username && collabChunks)
    return (
      <projectContext.Provider
        value={{
          ...project,
          isOwner: project.project.owner_id === currentUserData?.user.user_id,
        }}
      >
        <CollaborativeContext
          id={project.yjsDocId}
          collabChunks={collabChunks}
          user={user}
          config={project.collabConfig}
          eventApi={project.eventApi}
        >
          {children}
        </CollaborativeContext>
      </projectContext.Provider>
    );
  return <p>{message}</p>;
};

//
//
//

export const useProject = () => {
  const p = useContext(projectContext) as TProjectContext;
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

//
//
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
          <br /> Existing and running servers will reconnect to the project
          within one minute
        </p>
      </div>
      <div className="flex items-center gap-2 text-slate-400 mt-5">
        <p>
          <ButtonBase {...action} text="Start" className="blue" />
        </p>
      </div>
    </div>
  );
};
