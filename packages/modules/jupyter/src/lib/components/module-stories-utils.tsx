import {
  TCollaborativeChunk,
  TValidSharedData,
  SharedTypes,
  MockCollaborativeContext,
} from '@monorepo/collab-engine';
import {
  Servers_loadData,
  ServersReducer,
  TG_Server,
  TServersSharedData,
} from '@monorepo/servers';
import { TMyfetchRequest } from '@monorepo/simple-types';
import { Core_loadData, CoreReducer } from '@monorepo/core';
import {
  Space_loadData,
  SpaceReducer,
  defaultGraphView,
} from '@monorepo/space';

import { Jupyter_loadData, TJupyterSharedData } from '../jupyter-shared-model';
import { Jupyter_Load_Frontend_ExtraContext } from '../jupyter-shared-model-front';
import { JupyterReducer } from '../jupyter-reducer';

//

export const STORY_PROJECT_ID = 0;

export const STORY_PROJECT_SERVER_ID = 0;

const chunks: TCollaborativeChunk[] = [
  {
    sharedData: (st: SharedTypes) => Core_loadData(st),
    reducers: (sd: TValidSharedData) => [new CoreReducer()],
  },
  {
    sharedData: (st: SharedTypes) => {
      const sd = Space_loadData(st);
      sd.graphViews.set('story-view', defaultGraphView());
      return sd;
    },
    reducers: (sd: TValidSharedData) => [new SpaceReducer()],
  },
  {
    sharedData: (st: SharedTypes) => Servers_loadData(st),
    reducers: (sd: TValidSharedData) => [new ServersReducer(null as any)],
    extraContext: (sd: TValidSharedData) => {
      let mock_servers: TG_Server[] = [];
      return {
        // a mock toGanymede that returns a new server id to allow servers:new-server to work
        toGanymede: async (req: TMyfetchRequest) => {
          console.log({ req });
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
            };
          }

          if (
            req.method === 'GET' &&
            req.url === `/projects/{project_id}/servers`
          ) {
            return {
              _0: mock_servers,
            };
          }

          throw new Error('Not implemented');
        },

        // mock jwt payload
        jwt: {
          project_server_id: STORY_PROJECT_SERVER_ID,
        },

        // mock gatewayFQDN so that it ends to our test jupyter docker container
        gatewayFQDN: '127.0.0.1',
      };
    },
  },
  {
    sharedData: (st: SharedTypes) => Jupyter_loadData(st),
    reducers: (sd: TValidSharedData) => [new JupyterReducer(sd as any)],
    extraContext: (sd: TValidSharedData) => {
      return {
        ...Jupyter_Load_Frontend_ExtraContext(
          sd as TJupyterSharedData & TServersSharedData,
          // mocked getToken callback
          async (server) => {
            return 'My_Super_Test_Story';
          }
        ),
        // mock user jupyterlab token for JupyterReducer that run in backend in normal mode
        authorizationHeader: 'My_Super_Test_Story',
      };
    },
  },
];

//

export const JupyterStoryCollabContext = ({
  children,
}: {
  children: React.ReactNode;
}) => {
  return (
    <MockCollaborativeContext collabChunks={chunks}>
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
          --NotebookApp.token='My_Super_Test_Story' --debug
        </p>
        {children}
      </div>
    </MockCollaborativeContext>
  );
};
