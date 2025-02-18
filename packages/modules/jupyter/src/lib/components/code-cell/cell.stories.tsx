import type { Meta, StoryObj } from '@storybook/react';
import { useMemo } from 'react';

import { Logger } from '@monorepo/log';
import {
  CollaborativeContext,
  TCollaborativeChunk,
  TValidSharedData,
  SharedTypes,
  Dispatcher,
  useDispatcher,
  useSharedData,
} from '@monorepo/collab-engine';
import {
  Servers_loadData,
  ServersReducer,
  TG_Server,
  TServerEvents,
  TServersSharedData,
} from '@monorepo/servers';
import { TMyfetchRequest } from '@monorepo/simple-types';

import {
  Jupyter_Load_Frontend_ExtraContext,
  Jupyter_loadData,
  TJupyterSharedData,
} from '../../jupyter-shared-model';
import { JupyterReducer } from '../../jupyter-reducer';
import { useInjectServer } from '../terminal/test-use-inject-server';
import { TDemiurgeNotebookEvent } from '../../jupyter-events';
import { Cell } from './cell';

//

Logger.setPriority(7);

//

const MOCK_PROJECT_ID = 0;
const MOCK_PROJECT_SERVER_ID = 0;

const chunks: TCollaborativeChunk[] = [
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
              project_id: MOCK_PROJECT_ID,
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
          project_server_id: MOCK_PROJECT_SERVER_ID,
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

const StoryWrapper = () => {
  const dispatcher = useMemo(() => {
    return new Dispatcher();
  }, []);

  return (
    <CollaborativeContext
      id={'story'}
      collabChunks={chunks}
      config={{
        type: 'none',
      }}
      dispatcher={dispatcher}
      user={{
        username: 'John Doe',
        color: '#ffa500',
      }}
    >
      <Story />
    </CollaborativeContext>
  );
};

//

const Story = () => {
  useInjectServer();
  const dispatcher = useDispatcher<TDemiurgeNotebookEvent | TServerEvents>();

  const sd: TJupyterSharedData & TServersSharedData =
    useSharedData<TJupyterSharedData>(['jupyterServers', 'cells'], (sd) => sd);

  const server = sd.projectServers.get(`${MOCK_PROJECT_SERVER_ID}`);
  const jupyter = sd.jupyterServers.get(`${MOCK_PROJECT_SERVER_ID}`);
  const service = server?.httpServices.find((s) => s.name === 'jupyterlab');
  const kernel = jupyter?.kernels[0];
  const cell = Array.from(sd.cells.values()).filter(
    (c) => c.dkid === kernel?.dkid
  );

  // step 1: create server
  if (!jupyter) {
    dispatcher.dispatch({
      type: 'servers:new',
      serverName: 'story-server',
      imageId: 2, // Image id of jupyterlab minimal notebook docker image
    });
  }
  // step 2: map service
  else if (jupyter && !service) {
    dispatcher.dispatch({
      type: 'server:map-http-service',
      port: 36666,
      name: 'jupyterlab',
    });
  }
  // step 3: create kernel
  else if (service && !kernel) {
    dispatcher.dispatch({
      type: 'jupyter:new-kernel',
      kernelName: 'story-kernel',
      project_server_id: 0,
    });
  }
  // step 4: start kernel
  else if (kernel && !kernel.jkid) {
    dispatcher.dispatch({
      type: 'jupyter:start-kernel',
      dkid: kernel.dkid,
    });
  }
  // step 5: create cell
  else if (kernel && cell.length === 0) {
    dispatcher.dispatch({ type: 'jupyter:new-cell', dkid: kernel.dkid });
  }

  console.log({ sd, jupyter, kernel, cell });

  return cell.map((c) => (
    <div key={c.cellId} style={{ width: '450px', height: '400px' }}>
      <Cell cellId={c.cellId} />
    </div>
  ));
};

//

const meta = {
  title: 'Modules/Jupyter/Cell',
  component: StoryWrapper,
  parameters: {
    layout: 'centered',
  },
  argTypes: {},
} satisfies Meta<typeof StoryWrapper>;

export default meta;

type Story = StoryObj<typeof StoryWrapper>;

export const Default: Story = {
  args: {},
};
