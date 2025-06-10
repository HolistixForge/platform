import type { Meta, StoryObj } from '@storybook/react';

import { Logger } from '@monorepo/log';
import { useDispatcher, useSharedData } from '@monorepo/collab-engine';
import { TServerEvents, TServersSharedData } from '@monorepo/servers';
import { HolistixSpace } from '@monorepo/space/frontend';

import { TJupyterSharedData } from '../../jupyter-shared-model';
import { TDemiurgeNotebookEvent } from '../../jupyter-events';
import {
  JupyterStoryCollabContext,
  STORY_PROJECT_SERVER_ID,
} from '../../stories/module-stories-utils';
import { moduleFrontend } from '../../../frontend';

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

//

const Story = () => {
  const dispatcher = useDispatcher<TDemiurgeNotebookEvent | TServerEvents>();

  const sd: TJupyterSharedData & TServersSharedData = useSharedData<
    TJupyterSharedData & TServersSharedData
  >(['projectServers', 'jupyterServers'], (sd) => sd);

  const server = sd.projectServers.get(`${STORY_PROJECT_SERVER_ID}`);
  const jupyter = sd.jupyterServers.get(`${STORY_PROJECT_SERVER_ID}`);
  const service = server?.httpServices.find((s) => s.name === 'jupyterlab');
  const kernel = jupyter?.kernels[0];
  const cell = Object.keys(jupyter?.cells || {}).find(
    (c) => jupyter?.cells[c].kernel_id === kernel?.kernel_id
  );
  const terminal = jupyter?.terminals[0];

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
      type: 'jupyter:new-kernel-node',
      kernel_id: '0',
      project_server_id: 0,
    });
  }

  // step 5: create cell
  else if (kernel && !cell) {
    dispatcher.dispatch({
      type: 'jupyter:new-cell',
      kernel_id: kernel.kernel_id,
    });
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
      <HolistixSpace viewId={'story-view'} nodeTypes={moduleFrontend.nodes} />
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
