import { MockCollaborativeContext } from '@monorepo/collab-engine';
import { TJsonObject } from '@monorepo/simple-types';

import { moduleBackend as coreBackend } from '@monorepo/core';
import { moduleBackend as spaceBackend } from '@monorepo/space';
import {
  moduleBackend as serversBackend,
  TG_Server,
  TGanymedeExtraContext,
  TGatewayExtraContext,
} from '@monorepo/servers';
import { moduleBackend as jupyterBackend } from '@monorepo/jupyter';

import { moduleFrontend as coreFrontend } from '@monorepo/core';
import { moduleFrontend as spaceFrontend } from '@monorepo/space/frontend';
import { moduleFrontend as serversFrontend } from '@monorepo/servers/frontend';
import { moduleFrontend as jupyterFrontend } from '@monorepo/jupyter/frontend';
import { TMyfetchRequest } from '@monorepo/simple-types';

//

const STORY_TOKEN = 'My_Super_Test_Story';

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
                oauth: [],
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

const modulesFrontend = [
  {
    collabChunk: {
      name: 'authentication',
      loadExtraContext: () => ({ authentication: {} }),
    },
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
    </MockCollaborativeContext>
  );
};

// sd.graphViews.set('story-view', defaultGraphView());
