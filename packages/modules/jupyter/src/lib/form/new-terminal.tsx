import { useEffect } from 'react';

import {
  ButtonBase,
  FormError,
  FormErrors,
  useAction,
  DialogControlled,
  SelectFieldset,
  SelectItem,
} from '@monorepo/ui-base';
import { useDispatcher, useSharedData } from '@monorepo/collab-engine';
import { TPosition } from '@monorepo/core';
import { TDemiurgeNotebookEvent } from '../jupyter-events';
import { TJupyterSharedData } from '../jupyter-shared-model';
import { TJupyterServerData } from '../jupyter-types';
import { useJLsManager } from '../jupyter-shared-model-front';
import { TServer, TServersSharedData } from '@monorepo/servers';

type NewTerminalFormData = { terminal_id: string };

export const NewTerminalForm = ({
  project_server_id,
  position,
  viewId,
  closeForm,
}: {
  project_server_id: number;
  position: TPosition;
  viewId: string;
  closeForm: () => void;
}) => {
  const dispatcher = useDispatcher<TDemiurgeNotebookEvent>();
  const { jupyter: jmc } = useJLsManager();

  const sd = useSharedData<TServersSharedData & TJupyterSharedData>(
    ['projectServers', 'jupyterServers'],
    (sd) => sd
  );

  const server: TServer | undefined = sd.projectServers.get(
    project_server_id.toString()
  );

  const jupyter: TJupyterServerData | undefined = sd.jupyterServers.get(
    project_server_id.toString()
  );

  useEffect(() => {
    if (jupyter && server) {
      jmc.jlsManager.startPollingResources(server);
    }
  }, [jupyter, jmc, server]);

  const action = useAction<NewTerminalFormData>(
    (d) => {
      if (jupyter) {
        if (d.terminal_id === 'new') {
          return dispatcher.dispatch({
            type: 'jupyter:new-terminal',
            project_server_id: project_server_id,
            client_id: 'not needed here in storybook',
            origin: {
              viewId: viewId,
              position,
            },
          });
        } else {
          return dispatcher.dispatch({
            type: 'jupyter:new-terminal-node',
            project_server_id: project_server_id,
            client_id: 'not needed here in storybook',
            terminal_id: d.terminal_id,
            origin: {
              viewId: viewId,
              position,
            },
          });
        }
      } else throw new Error('No such server');
    },
    [dispatcher, position, project_server_id, jupyter, viewId],
    {
      startOpened: true,
      checkForm: (d, e) => {
        if (!d.terminal_id) e.terminal_id = 'Please select a terminal';
      },
    }
  );

  useEffect(() => {
    if (!action.isOpened) {
      closeForm();
    }
  }, [action.isOpened]);

  return (
    <DialogControlled
      title="New Terminal"
      description="Select an existing terminal or create a new one."
      open={action.isOpened}
      onOpenChange={action.close}
    >
      <FormError errors={action.errors} id="terminal_id" />

      <SelectFieldset
        name="terminal_id"
        value={action.formData.terminal_id}
        onChange={(v) => action.handleChange({ terminal_id: v })}
        placeholder="Select Terminal"
      >
        <SelectItem key="new" value="new">
          Create New Terminal
        </SelectItem>
        {Object.values(jupyter?.terminals || {}).map((t) => (
          <SelectItem key={t.terminal_id} value={t.terminal_id}>
            {t.terminal_id}
          </SelectItem>
        ))}
      </SelectFieldset>

      <FormErrors errors={action.errors} />
      <div
        style={{ display: 'flex', marginTop: 25, justifyContent: 'flex-end' }}
      >
        <ButtonBase
          className="submit"
          callback={() => action.callback(action.formData)}
          text={
            action.formData.terminal_id === 'new'
              ? 'Create Terminal'
              : 'Select Terminal'
          }
          loading={action.loading}
        />
      </div>
    </DialogControlled>
  );
};
