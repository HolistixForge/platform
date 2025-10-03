import { useCallback, useEffect, useState } from 'react';

import {
  MockCollaborativeContext,
  useSharedData,
  useDispatcher,
} from '@monorepo/collab-engine';
import { TJsonObject, TMyfetchRequest } from '@monorepo/simple-types';
import { TServersSharedData, TServerEvents } from '@monorepo/user-containers';
import { TCoreSharedData } from '@monorepo/core-graph';

//

import { moduleBackend as coreBackend } from '@monorepo/core-graph';
import { moduleBackend as spaceBackend } from '@monorepo/space';
import {
  moduleBackend as userContainersBackend,
  TG_Server,
} from '@monorepo/user-containers';
//
import { moduleFrontend as coreFrontend } from '@monorepo/core-graph';
import { moduleFrontend as spaceFrontend } from '@monorepo/space/frontend';
import { STORY_VIEW_ID } from '@monorepo/space/stories';
import {
  moduleFrontend as userContainersFrontend,
  TAuthenticationExtraContext,
} from '@monorepo/user-containers/frontend';
import { ModuleFrontend } from '@monorepo/module/frontend';

//

import { moduleBackend as jupyterBackend, TJupyterEvent } from '../../';
import { moduleFrontend as jupyterFrontend } from '../../frontend';

import { TJupyterSharedData } from '../../lib/jupyter-shared-model';

//

const STORY_TOKEN = 'My_Super_Test_Story';

const STORY_JUPYTERLAB_CLIENT_ID = 'jupyterlab-story';

export const STORY_PROJECT_ID = 0;

export const STORY_PROJECT_SERVER_ID = 0;

const STORY_JUPYTER_PORT = 36666;
const STORY_JUPYTER_IP = '127.0.0.1';

//

let mock_servers: TG_Server[] = [];

const modulesBackend = [
  {
    collabChunk: {
      name: 'gateway',
      loadExtraContext: (): any => ({
        gateway: {
          updateReverseProxy: async () => {},
          gatewayFQDN: STORY_JUPYTER_IP,
        },
      }),
    },
  },
  {
    collabChunk: {
      name: 'ganymede',
      loadExtraContext: (): any => ({
        ganymede: {
          toGanymede: async <T,>(req: TMyfetchRequest): Promise<T> => {
            if (
              req.method === 'POST' &&
              req.url === `/projects/{project_id}/servers`
            ) {
              const psid = mock_servers.length;
              mock_servers.push({
                project_server_id: psid,
                server_name: (req.jsonBody as any)?.name || 'story-server',
                image_id: (req.jsonBody as any)?.imageId || 2,
                project_id: STORY_PROJECT_ID,
                host_user_id: null,
                oauth: [
                  {
                    service_name: 'jupyterlab',
                    client_id: STORY_JUPYTERLAB_CLIENT_ID,
                  },
                ],
                location: 'none',
              });
              return {
                _0: {
                  new_project_server_id: psid,
                },
              } as T;
            }

            if (
              req.method === 'GET' &&
              req.url === `/projects/{project_id}/servers`
            ) {
              return {
                _0: mock_servers,
              } as T;
            }

            throw new Error('Not implemented');
          },
        },
      }),
    },
  },
  coreBackend,
  spaceBackend,
  userContainersBackend,
  jupyterBackend,
];

//

export const modulesFrontend: ModuleFrontend[] = [
  {
    collabChunk: {
      name: 'authentication',
      loadExtraContext: (): TAuthenticationExtraContext => ({
        authentication: {
          getToken: async (clientId: string) => {
            if (clientId === STORY_JUPYTERLAB_CLIENT_ID) return STORY_TOKEN;
            throw new Error('Not implemented');
          },
        },
      }),
    },
    nodes: {},
    spaceMenuEntries: () => [],
  },
  coreFrontend,
  spaceFrontend,
  userContainersFrontend,
  jupyterFrontend,
];

//

const getRequestContext = (event: TJsonObject): TJsonObject => {
  if (event.type === 'user-container:map-http-service') {
    // mock jwt payload for a server 'map http service' event
    const r = {
      jwt: {
        user_container_id: STORY_PROJECT_USER_CONTAINER_ID,
      },
    };
    return r;
  }
  // the token
  return {
    authorizationHeader: STORY_TOKEN,
  };
};

//

export const JupyterStoryCollabContext = ({
  children,
}: {
  children: React.ReactNode;
}) => {
  return (
    <MockCollaborativeContext
      frontChunks={modulesFrontend.map((m) => m.collabChunk)}
      backChunks={modulesBackend.map((m) => m.collabChunk)}
      getRequestContext={getRequestContext}
    >
      <JupyterStoryInit>{children}</JupyterStoryInit>
    </MockCollaborativeContext>
  );
};

//

export const JupyterStoryInit = ({
  children,
}: {
  children: React.ReactNode;
}) => {
  const { isLoading, error } = useInitStoryJupyterServer();

  console.log('JupyterStoryInit', { isLoading, error });

  if (isLoading || error) {
    return (
      <div style={{ width: '80vw', height: '800px' }}>
        <p>
          To test this story, first launch a jupyter docker container, then
          refresh :
        </p>
        <p
          style={{
            fontFamily: 'monospace',
            backgroundColor: '#2b2b2b',
            color: '#e6e6e6',
            padding: '8px',
            borderRadius: '4px',
            margin: '20px 0',
          }}
        >
          $ docker run --rm -p {STORY_JUPYTER_PORT}:8888
          jupyter/minimal-notebook:latest start-notebook.sh
          --NotebookApp.allow_origin='*' --NotebookApp.token='{STORY_TOKEN}'
          --debug
        </p>
        {error && <div style={{ color: 'red' }}>Error: {error.message}</div>}
      </div>
    );
  }

  return <>{children}</>;
};

//

interface UseInitStoryJupyterServerResult {
  isLoading: boolean;
  error: Error | null;
}

export const useInitStoryJupyterServer =
  (): UseInitStoryJupyterServerResult => {
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<Error | null>(null);
    const sd = useSharedData<
      TServersSharedData & TJupyterSharedData & TCoreSharedData
    >(['projectServers', 'jupyterServers'], (sd) => sd);
    const dispatcher = useDispatcher<TServerEvents | TJupyterEvent>();

    const server = sd.projectServers.get(STORY_PROJECT_SERVER_ID.toString());
    const jupyter = sd.jupyterServers.get(STORY_PROJECT_SERVER_ID.toString());
    const service = server?.httpServices.find(
      (s: { name: string }) => s.name === 'jupyterlab'
    );

    const [running, setRunning] = useState<boolean | null>(null);

    useEffect(() => {
      fetch(`http://${STORY_JUPYTER_IP}:${STORY_JUPYTER_PORT}/api`).then(
        (r) => {
          if (r.status === 200) {
            console.log('Jupyter server is running');
            setRunning(true);
          } else {
            setRunning(false);
          }
        }
      );
    }, []);

    const initializeServer = useCallback(async () => {
      console.log('initializeServer', { server, jupyter, service });
      try {
        if (running === null) {
          return;
        } else if (running === false) {
          setError(new Error('Jupyter server is not running'));
          setIsLoading(false);
          return;
        }

        // Step 1: Create server if it doesn't exist
        else if (!jupyter) {
          await dispatcher.dispatch({
            type: 'user-containers:new',
            from: {
              new: {
                userContainerName: 'story-user-container',
                imageId: 'jupyter:minimal', // Image id of jupyterlab minimal notebook docker image
              },
            },
            origin: {
              viewId: STORY_VIEW_ID,
              position: {
                x: 200,
                y: 200,
              },
            },
          });
        }
        // Step 2: Map service if server exists but service doesn't
        else if (jupyter && !service) {
          await dispatcher.dispatch({
            type: 'server:map-http-service',
            port: STORY_JUPYTER_PORT,
            name: 'jupyterlab',
          });
        }

        // Only set loading to false if we have a service
        else if (service) {
          console.log('Jupyter server is initialized');
          isLoading && setIsLoading(false);
        }
      } catch (err) {
        setError(
          err instanceof Error ? err : new Error('Failed to initialize server')
        );
        isLoading && setIsLoading(false);
      }
    }, [isLoading, jupyter, service, dispatcher, running]);

    useEffect(() => {
      initializeServer();
    }, [initializeServer]);

    return {
      isLoading,
      error,
    };
  };
