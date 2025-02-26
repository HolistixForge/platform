import type { Meta, StoryObj } from '@storybook/react';

import { Logger } from '@monorepo/log';
import { TServerEvents, TServersSharedData } from '@monorepo/servers';
import { useDispatcher, useSharedData } from '@monorepo/collab-engine';

import { TJupyterSharedData } from '../../jupyter-shared-model';
import { TDemiurgeNotebookEvent } from '../../jupyter-events';
import {
  JupyterStoryCollabContext,
  STORY_PROJECT_SERVER_ID,
} from '../module-stories-utils';
import { JupyterTerminal } from './terminal';

//

Logger.setPriority(7);

//

const StoryWrapper = () => {
  return (
    <JupyterStoryCollabContext>
      <Terminals />
    </JupyterStoryCollabContext>
  );
};

//

const Terminals = () => {
  const dispatcher = useDispatcher<TDemiurgeNotebookEvent | TServerEvents>();

  const sd: TJupyterSharedData & TServersSharedData = useSharedData<
    TJupyterSharedData & TServersSharedData
  >(['projectServers', 'jupyterServers', 'cells', 'terminals'], (sd) => sd);

  const server = sd.projectServers.get(`${STORY_PROJECT_SERVER_ID}`);
  const jupyter = sd.jupyterServers.get(`${STORY_PROJECT_SERVER_ID}`);
  const service = server?.httpServices.find((s) => s.name === 'jupyterlab');
  const terminal = Array.from(sd.terminals.values())[0];

  console.log(
    '##########',
    structuredClone({ server, jupyter, service, terminal })
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
  // step 3: create terminal
  else if (service && !terminal) {
    dispatcher.dispatch({
      type: 'jupyter:new-terminal',
      project_server_id: STORY_PROJECT_SERVER_ID,
      client_id: 'not needed here in storybook',
    });
  }

  if (terminal) return <JupyterTerminal terminalId={terminal.terminalId} />;

  return null;
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
