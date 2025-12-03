import type { Meta, StoryObj } from '@storybook/react';
import { useEffect, useState } from 'react';

import { Logger } from '@holistix/log';
import { TServerEvents, TServersSharedData } from '@holistix/user-containers';
import { useLocalSharedData } from '@holistix/collab/frontend';
import { useDispatcher } from '@holistix/reducers/frontend';
import { ButtonBase, SelectFieldset, SelectItem } from '@holistix/ui-base';

import { TJupyterEvent } from '../../jupyter-events';
import {
  JupyterStoryCollabContext,
  STORY_USER_CONTAINER_ID,
} from '../../stories/module-stories-utils';
import { JupyterTerminal } from './terminal';
import { useJLsManager } from '../../jupyter-shared-model-front';
import { TJupyterSharedData } from '../../jupyter-shared-model';
import { TJupyterServerData } from '../../jupyter-types';

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
  const dispatcher = useDispatcher<TJupyterEvent | TServerEvents>();
  const { jupyter: jmc } = useJLsManager();

  const sd = useLocalSharedData<TServersSharedData & TJupyterSharedData>(
    ['user-containers:containers', 'jupyter:servers'],
    (sd) => sd
  );
  const server = sd['user-containers:containers'].get(
    STORY_USER_CONTAINER_ID.toString()
  );
  const jupyter: TJupyterServerData | undefined = sd['jupyter:servers'].get(
    STORY_USER_CONTAINER_ID.toString()
  );
  const service = server?.httpServices.find(
    (s: { name: string }) => s.name === 'jupyterlab'
  );

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
      project_server_id: STORY_USER_CONTAINER_ID,
      client_id: 'not needed here in storybook',
    });
  };

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
            userContainerId={STORY_USER_CONTAINER_ID}
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
