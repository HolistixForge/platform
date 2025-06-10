import { useCallback, useEffect, useState } from 'react';

import {
  MockCollaborativeContext,
  useSharedData,
  useDispatcher,
} from '@monorepo/collab-engine';
import { TJsonObject, TMyfetchRequest } from '@monorepo/simple-types';
import { TServersSharedData, TServerEvents } from '@monorepo/servers';
import { TCoreSharedData } from '@monorepo/core';

//

import { moduleBackend as coreBackend } from '@monorepo/core';
import { moduleBackend as spaceBackend } from '@monorepo/space';
import {
  moduleBackend as serversBackend,
  TG_Server,
  TGanymedeExtraContext,
  TGatewayExtraContext,
} from '@monorepo/servers';
//
import { moduleFrontend as coreFrontend } from '@monorepo/core';
import {
  moduleFrontend as spaceFrontend,
  STORY_VIEW_ID,
} from '@monorepo/space/frontend';
import {
  moduleFrontend as serversFrontend,
  TAuthenticationExtraContext,
} from '@monorepo/servers/frontend';
import { ModuleFrontend } from '@monorepo/module/frontend';

//

import {
  moduleBackend as jupyterBackend,
  TDemiurgeNotebookEvent,
} from '../../';
import { moduleFrontend as jupyterFrontend } from '../../frontend';

import { TJupyterSharedData } from '../../lib/jupyter-shared-model';

//

const STORY_TOKEN = 'My_Super_Test_Story';

const STORY_JUPYTERLAB_CLIENT_ID = 'jupyterlab-story';

export const STORY_PROJECT_ID = 0;

export const STORY_PROJECT_SERVER_ID = 0;

//

let mock_servers: TG_Server[] = [];

const modulesBackend = [
  {
    collabChunk: {
      name: 'gateway',
      loadExtraContext: (): TGatewayExtraContext => ({
        gateway: {
          updateReverseProxy: async () => {},
          gatewayFQDN: '127.0.0.1',
        },
      }),
    },
  },
  {
    collabChunk: {
      name: 'ganymede',
      loadExtraContext: (): TGanymedeExtraContext => ({
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
  serversBackend,
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
    spaceMenuEntries: [],
  },
  coreFrontend,
  spaceFrontend,
  serversFrontend,
  jupyterFrontend,
];

//

const getRequestContext = (event: TJsonObject): TJsonObject => {
  if (event.type === 'server:map-http-service') {
    // mock jwt payload for a server 'map http service' event
    const r = {
      jwt: {
        project_server_id: STORY_PROJECT_SERVER_ID,
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

  if (isLoading) {
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
          $ docker run --rm -p 36666:8888 jupyter/minimal-notebook:latest
          start-notebook.sh --NotebookApp.allow_origin='*'
          --NotebookApp.token='${STORY_TOKEN}' --debug
        </p>
        {children}
      </div>
    );
  }

  if (error) {
    return <div>Error: {error.message}</div>;
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
    const dispatcher = useDispatcher<TServerEvents | TDemiurgeNotebookEvent>();

    const server = sd.projectServers.get(STORY_PROJECT_SERVER_ID.toString());
    const jupyter = sd.jupyterServers.get(STORY_PROJECT_SERVER_ID.toString());
    const service = server?.httpServices.find(
      (s: { name: string }) => s.name === 'jupyterlab'
    );

    const initializeServer = useCallback(async () => {
      console.log('initializeServer', { server, jupyter, service });
      try {
        // Step 1: Create server if it doesn't exist
        if (!jupyter) {
          await dispatcher.dispatch({
            type: 'servers:new',
            from: {
              new: {
                serverName: 'story-server',
                imageId: 2, // Image id of jupyterlab minimal notebook docker image
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
            port: 36666,
            name: 'jupyterlab',
          });
        }

        // Only set loading to false if we have a service
        if (service) {
          setIsLoading(false);
        }
      } catch (err) {
        setError(
          err instanceof Error ? err : new Error('Failed to initialize server')
        );
        setIsLoading(false);
      }
    }, [jupyter, service, dispatcher]);

    useEffect(() => {
      initializeServer();
    }, [initializeServer]);

    return {
      isLoading,
      error,
    };
  };
