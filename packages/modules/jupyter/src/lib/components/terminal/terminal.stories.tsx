import type { Meta, StoryObj } from '@storybook/react';
import { useEffect, useState } from 'react';

import { Logger } from '@monorepo/log';
import { TServerEvents, TServersSharedData } from '@monorepo/servers';
import { useDispatcher, useSharedData } from '@monorepo/collab-engine';
import { ButtonBase, SelectFieldset, SelectItem } from '@monorepo/ui-base';

import { TJupyterSharedData } from '../../jupyter-shared-model';
import { TDemiurgeNotebookEvent } from '../../jupyter-events';
import {
  JupyterStoryCollabContext,
  STORY_PROJECT_SERVER_ID,
} from '../../stories/module-stories-utils';
import { JupyterTerminal } from './terminal';
import { useJLsManager } from '../../jupyter-shared-model-front';

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
  >(['projectServers', 'jupyterServers'], (sd) => sd);

  const { jupyter: jmc } = useJLsManager();

  const server = sd.projectServers.get(`${STORY_PROJECT_SERVER_ID}`);
  const jupyter = sd.jupyterServers.get(`${STORY_PROJECT_SERVER_ID}`);
  const service = server?.httpServices.find((s) => s.name === 'jupyterlab');

  console.log(
    '########## ##########',
    structuredClone({ server, jupyter, service })
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

  useEffect(() => {
    if (server && service && jupyter) {
      console.log({ jmc });
      jmc.jlsManager.startPollingResources(server);
    }
  }, [jupyter, jmc, server, service]);

  const [terminalId, setTerminalId] = useState<string | null>(
    Object.keys(jupyter?.terminals || {})[0] || null
  );

  const handleNewTerminal = () => {
    dispatcher.dispatch({
      type: 'jupyter:new-terminal',
      project_server_id: STORY_PROJECT_SERVER_ID,
      client_id: 'not needed here in storybook',
    });
  };

  //

  return (
    <div>
      {jupyter?.terminals && (
        <SelectFieldset
          name="terminal"
          value={terminalId || ''}
          onChange={(v) => setTerminalId(v)}
          placeholder="Select a terminal"
        >
          {Object.values(jupyter.terminals).map((t) => (
            <SelectItem key={t.terminal_id} value={t.terminal_id}>
              {t.terminal_id}
            </SelectItem>
          ))}
        </SelectFieldset>
      )}

      <ButtonBase callback={handleNewTerminal}>New Terminal</ButtonBase>

      {terminalId !== null && (
        <div
          style={{
            height: '50vh',
            width: '80vw',
          }}
        >
          <JupyterTerminal
            terminalId={terminalId}
            projectServerId={STORY_PROJECT_SERVER_ID}
          />
        </div>
      )}
    </div>
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
