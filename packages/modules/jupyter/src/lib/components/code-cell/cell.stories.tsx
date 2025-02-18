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
  TEventNewServer,
  TServer,
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

const chunks: TCollaborativeChunk[] = [
  {
    sharedData: (st: SharedTypes) => Servers_loadData(st),
    reducers: (sd: TValidSharedData) => [new ServersReducer(sd as any)],
    extraContext: (sd: TValidSharedData) => {
      let mock_servers: TServer[] = [];
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
              httpServices: [
                {
                  name: 'jupyterlab',
                  host: '127.0.0.1',
                  port: 36666,
                  location: '',
                  secure: false,
                },
              ],
              last_watchdog_at: null,
              last_activity: null,
              ec2_instance_state: null,
              type: '',
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
      };
    },
  },
  {
    sharedData: (st: SharedTypes) => Jupyter_loadData(st),
    reducers: (sd: TValidSharedData) => [new JupyterReducer(sd as any)],
    extraContext: (sd: TValidSharedData) =>
      Jupyter_Load_Frontend_ExtraContext(
        sd as TJupyterSharedData & TServersSharedData,
        // mocked getToken callback
        async (server) => {
          return 'My_Super_Test_Story';
        }
      ),
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
  const dispatcher = useDispatcher<TDemiurgeNotebookEvent | TEventNewServer>();

  const sd: TJupyterSharedData = useSharedData<TJupyterSharedData>(
    ['jupyterServers', 'cells'],
    (sd) => sd
  );

  const jupyter = sd.jupyterServers.get('0');
  const kernel = jupyter?.kernels[0];
  const cell = Array.from(sd.cells.values()).filter(
    (c) => c.dkid === kernel?.dkid
  );

  if (!sd.jupyterServers.get('0')) {
    dispatcher.dispatch({
      type: 'servers:new',
      serverName: 'story-server',
      imageId: 2, // Image id of jupyterlab minimal notebook docker image
    });
  } else if (jupyter && !kernel) {
    dispatcher.dispatch({
      type: 'jupyter:new-kernel',
      kernelName: 'story-kernel',
      project_server_id: 0,
    });
  } else if (kernel && cell.length === 0) {
    dispatcher.dispatch({ type: 'jupyter:new-cell', dkid: kernel.dkid });
  }

  console.log({ sd, jupyter, kernel, cell });

  return cell.map((c) => <Cell key={c.cellId} cellId={c.cellId} />);
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
