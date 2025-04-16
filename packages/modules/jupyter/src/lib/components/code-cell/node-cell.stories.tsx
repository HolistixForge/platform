import type { Meta, StoryObj } from '@storybook/react';

import { Logger } from '@monorepo/log';
import { useDispatcher, useSharedData } from '@monorepo/collab-engine';
import { TServerEvents, TServersSharedData } from '@monorepo/servers';
import { SpaceModule } from '@monorepo/space';

import { TJupyterSharedData } from '../../jupyter-shared-model';
import { TDemiurgeNotebookEvent } from '../../jupyter-events';
import {
  JupyterStoryCollabContext,
  STORY_PROJECT_SERVER_ID,
} from '../module-stories-utils';
import { NodeCell } from './cell';
import { NodeKernel } from '../node-kernel/node-kernel';
import { NodeTerminal } from '../terminal/terminal';

//

Logger.setPriority(7);

//

const StoryWrapper = () => {
  return (
    <JupyterStoryCollabContext>
      <Story />
    </JupyterStoryCollabContext>
  );
};

//

const nodeTypes = {
  'jupyter-cell': NodeCell,
  'jupyter-kernel': NodeKernel,
  'jupyter-terminal': NodeTerminal,
};

//

const Story = () => {
  const dispatcher = useDispatcher<TDemiurgeNotebookEvent | TServerEvents>();

  const sd: TJupyterSharedData & TServersSharedData = useSharedData<
    TJupyterSharedData & TServersSharedData
  >(['projectServers', 'jupyterServers', 'cells'], (sd) => sd);

  const server = sd.projectServers.get(`${STORY_PROJECT_SERVER_ID}`);
  const jupyter = sd.jupyterServers.get(`${STORY_PROJECT_SERVER_ID}`);
  const service = server?.httpServices.find((s) => s.name === 'jupyterlab');
  const kernel = jupyter?.kernels[0];
  const cell = Array.from(sd.cells.values()).filter(
    (c) => c.dkid === kernel?.dkid
  );
  const terminal = Array.from(sd.terminals.values())[0];

  console.log(
    '##########',
    structuredClone({ server, jupyter, service, kernel, cell })
  );

  // step 1: create server
  if (!jupyter) {
    dispatcher.dispatch({
      type: 'servers:new',
      from: {
        new: {
          serverName: 'story-server',
          imageId: 2, // Image id of jupyterlab minimal notebook docker image
        },
      },
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
      client_id: 'not needed here in storybook',
    });
  }
  // step 5: create cell
  else if (kernel && cell.length === 0) {
    dispatcher.dispatch({ type: 'jupyter:new-cell', dkid: kernel.dkid });
  }
  // step 6: create terminal
  else if (cell && !terminal) {
    dispatcher.dispatch({
      type: 'jupyter:new-terminal',
      project_server_id: STORY_PROJECT_SERVER_ID,
      client_id: 'not needed here in storybook',
    });
  }

  return (
    <div style={{ width: '100%', height: '80vh' }}>
      <SpaceModule viewId={'story-view'} nodeTypes={nodeTypes} />
    </div>
  );
};

//

const meta = {
  title: 'Modules/Jupyter/Node Cell',
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
