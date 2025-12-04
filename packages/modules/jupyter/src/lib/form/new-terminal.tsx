import { useEffect } from 'react';

import {
  ButtonBase,
  FormError,
  FormErrors,
  useAction,
  DialogControlled,
  SelectFieldset,
  SelectItem,
} from '@holistix/ui-base';
import { useLocalSharedData } from '@holistix/collab/frontend';
import { useDispatcher } from '@holistix/reducers/frontend';
import { TPosition } from '@holistix/core-graph';
import { TJupyterEvent } from '../jupyter-events';
import { TJupyterSharedData } from '../jupyter-shared-model';
import { TJupyterServerData } from '../jupyter-types';
import { useJLsManager } from '../jupyter-hooks';
import {
  TUserContainer,
  TUserContainersSharedData,
} from '@holistix/user-containers';

type NewTerminalFormData = { terminal_id: string };

export const NewTerminalForm = ({
  user_container_id,
  position,
  viewId,
  closeForm,
}: {
  user_container_id: string;
  position: TPosition;
  viewId: string;
  closeForm: () => void;
}) => {
  const dispatcher = useDispatcher<TJupyterEvent>();
  const jlsManager = useJLsManager();

  const sd = useLocalSharedData<TUserContainersSharedData & TJupyterSharedData>(
    ['user-containers:containers', 'jupyter:servers'],
    (sd) => sd
  );

  const server: TUserContainer | undefined =
    sd['user-containers:containers'].get(user_container_id);

  const jupyter: TJupyterServerData | undefined =
    sd['jupyter:servers'].get(user_container_id);

  useEffect(() => {
    if (jupyter && server) {
      jlsManager.startPollingResources(server);
    }
  }, [jupyter, jlsManager, server]);

  const action = useAction<NewTerminalFormData>(
    (d) => {
      if (jupyter) {
        if (d.terminal_id === 'new') {
          return dispatcher.dispatch({
            type: 'jupyter:new-terminal',
            user_container_id: user_container_id,
            client_id: 'not needed here in storybook',
            origin: {
              viewId: viewId,
              position,
            },
          });
        } else {
          return dispatcher.dispatch({
            type: 'jupyter:new-terminal-node',
            user_container_id: user_container_id,
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
    [dispatcher, position, user_container_id, jupyter, viewId],
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
  }, [action.isOpened, closeForm]);

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
