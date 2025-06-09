import type { Meta, StoryObj } from '@storybook/react';

import { Logger } from '@monorepo/log';
import { useDispatcher, useSharedData } from '@monorepo/collab-engine';
import { TServerEvents, TServersSharedData } from '@monorepo/servers';

import { TJupyterSharedData } from '../../jupyter-shared-model';
import { TDemiurgeNotebookEvent } from '../../jupyter-events';
import {
  JupyterStoryCollabContext,
  STORY_PROJECT_SERVER_ID,
} from '../../stories/module-stories-utils';
import { CellStory } from './cell';

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

const Story = () => {
  const dispatcher = useDispatcher<TDemiurgeNotebookEvent | TServerEvents>();

  const sd: TJupyterSharedData & TServersSharedData = useSharedData<
    TJupyterSharedData & TServersSharedData
  >(['projectServers', 'jupyterServers'], (sd) => sd);

  const server = sd.projectServers.get(`${STORY_PROJECT_SERVER_ID}`);
  const jupyter = sd.jupyterServers.get(`${STORY_PROJECT_SERVER_ID}`);
  const service = server?.httpServices.find((s) => s.name === 'jupyterlab');
  const kernel = jupyter?.kernels[0];
  const cellId = Object.keys(jupyter?.cells || {})[0] || undefined;

  console.log(
    '########## ##########',
    structuredClone({ server, jupyter, service, kernel, cellId })
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

  // step 5: create cell
  else if (kernel && !cellId) {
    dispatcher.dispatch({
      type: 'jupyter:new-cell',
      kernel_id: kernel.kernel_id,
    });
  }

  if (cellId) {
    return (
      <div style={{ width: '450px', height: '400px' }}>
        <CellStory projectServerId={STORY_PROJECT_SERVER_ID} cellId={cellId} />
      </div>
    );
  }

  return null;
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
