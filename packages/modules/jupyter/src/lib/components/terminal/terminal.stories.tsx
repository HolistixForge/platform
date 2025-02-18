import type { Meta, StoryObj } from '@storybook/react';
import { useMemo } from 'react';

import { Logger } from '@monorepo/log';
import {
  CollaborativeContext,
  TCollaborativeChunk,
  TValidSharedData,
  SharedTypes,
  Dispatcher,
} from '@monorepo/collab-engine';
import {
  Servers_loadData,
  ServersReducer,
  TServersSharedData,
} from '@monorepo/servers';

import {
  Jupyter_Load_Frontend_ExtraContext,
  Jupyter_loadData,
  TJupyterSharedData,
} from '../../jupyter-shared-model';
import { JupyterReducer } from '../../jupyter-reducer';
import { JupyterTerminal } from './terminal';
import { useInjectServer } from './test-use-inject-server';

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
      <Terminals />
    </CollaborativeContext>
  );
};

//

const Terminals = () => {
  const { servers } = useInjectServer();

  return (
    <>
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
        }}
      >
        $ docker run --rm -p 36666:8888 jupyter/minimal-notebook:latest
        start-notebook.sh --NotebookApp.allow_origin='*'
        --NotebookApp.token='My_Super_Test_Story' --debug
      </p>

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
