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
  SharedMap,
} from '@monorepo/collab-engine';
import {
  Servers_loadData,
  ServersReducer,
  TServer,
  TServersSharedData,
} from '@monorepo/servers';

import {
  Jupyter_Load_Frontend_ExtraContext,
  Jupyter_loadData,
  TJupyterSharedData,
} from '../../jupyter-shared-model';
import { JupyterReducer } from '../../jupyter-reducer';
import { JupyterTerminal } from './terminal';
import { TEventNewServer } from '../../../../../servers/dist/lib/servers-events';

//

Logger.setPriority(7);

//

const chunks: TCollaborativeChunk[] = [
  {
    sharedData: (st: SharedTypes) => Servers_loadData(st),
    reducers: (sd: TValidSharedData) => [new ServersReducer(sd as any)],
  },
  {
    sharedData: (st: SharedTypes) => Jupyter_loadData(st),
    reducers: (sd: TValidSharedData) => [new JupyterReducer(sd as any)],
    extraContext: (sd: TValidSharedData) =>
      Jupyter_Load_Frontend_ExtraContext(
        sd as TJupyterSharedData & TServersSharedData,
        // getToken callback
        async (server) => {
          return 'My_Super_Test_Story';
        }
      ),
  },
];

//

const StoryWrapper = () => {
  const dispatcher = useMemo(() => {
    return new Dispatcher({});
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
      <Terminals />
    </CollaborativeContext>
  );
};

//
const Terminals = () => {
  const dispatcher = useDispatcher<TEventNewServer>();
  const servers: SharedMap<TServer> = useSharedData<TServersSharedData>(
    ['projectServers'],
    (sd) => sd.projectServers
  );

  console.log(servers);

  const arr = Array.from(servers.values());

  const onNew = () => {
    const hostname = '127.0.0.1';

    /*
     * Direct brutal injection of server data !
     */

    dispatcher._sharedTypes.transaction(async () => {
      servers.set(`${arr.length}`, {
        project_server_id: arr.length,
        project_id: 0,
        server_name: `server ${arr.length}`,
        image_id: 0,
        host_user_id: null,
        oauth: [],
        location: 'none',
        httpServices: [
          {
            name: 'jupyterlab',
            host: hostname,
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
    });
  };

  return (
    <>
      <p>To test this story, first launch a jupyter docker container :</p>
      <p
        style={{
          fontFamily: 'monospace',
          backgroundColor: '#2b2b2b',
          color: '#e6e6e6',
          padding: '8px',
          borderRadius: '4px',
        }}
      >
        $ docker run --rm -p 36666:8888 jupyter/minimal-notebook:latest
        start-notebook.sh --NotebookApp.allow_origin='*'
        --NotebookApp.token='My_Super_Test_Story' --debug
      </p>
      <button
        onClick={onNew}
        style={{
          backgroundColor: '#4CAF50',
          border: 'none',
          color: 'white',
          padding: '12px 24px',
          textAlign: 'center',
          textDecoration: 'none',
          display: 'inline-block',
          fontSize: '16px',
          margin: '4px 2px',
          cursor: 'pointer',
          borderRadius: '4px',
          fontWeight: 'bold',
          boxShadow: '0 2px 4px rgba(0,0,0,0.2)',
          transition: 'background-color 0.3s',
        }}
        onMouseOver={(e) => (e.currentTarget.style.backgroundColor = '#45a049')}
        onMouseOut={(e) => (e.currentTarget.style.backgroundColor = '#4CAF50')}
      >
        Load Terminal
      </button>
      {Array.from(servers.values()).map((server) => (
        <JupyterTerminal
          key={server.project_server_id}
          project_server_id={server.project_server_id}
        />
      ))}
    </>
  );
};

//

const meta = {
  title: 'Modules/Jupyter/Terminal',
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
