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
import { useLocalSharedData } from '@monorepo/collab/frontend';
import { useDispatcher } from '@monorepo/reducers/frontend';
import { TPosition } from '@monorepo/core-graph';
import { TEventNewKernelNode } from '../jupyter-events';
import { TJupyterSharedData } from '../jupyter-shared-model';
import { TJupyterServerData } from '../jupyter-types';
import { useJLsManager } from '../jupyter-shared-model-front';
import { TServer, TServersSharedData } from '@monorepo/user-containers';

/**
 *
 */

type NewKernelFormData = { kernel_id: string };

/**
 *
 */

export const NewKernelForm = ({
  user_container_id,
  position,
  viewId,
  closeForm,
}: {
  user_container_id: number;
  position: TPosition;
  viewId: string;
  closeForm: () => void;
}) => {
  //

  const dispatcher = useDispatcher<TEventNewKernelNode>();

  const { jupyter: jmc } = useJLsManager();

  const sd = useLocalSharedData<TServersSharedData & TJupyterSharedData>(
    ['user-containers:containers', 'jupyter:servers'],
    (sd) => sd
  );

  const server: TServer | undefined = sd['user-containers:containers'].get(
    user_container_id.toString()
  );

  const jupyter: TJupyterServerData | undefined = sd['jupyter:servers'].get(
    user_container_id.toString()
  );

  useEffect(() => {
    if (jupyter && server) {
      jmc.jlsManager.startPollingResources(server);
    }
  }, [jupyter, jmc, server]);

  const action = useAction<NewKernelFormData>(
    (d) => {
      if (jupyter) {
        return dispatcher.dispatch({
          type: 'jupyter:new-kernel-node',
          kernel_id: d.kernel_id as string,
          user_container_id: user_container_id,
          origin: {
            viewId: viewId,
            position,
          },
        });
      } else throw new Error('No such server');
    },
    [dispatcher, position, user_container_id, jupyter, viewId],
    {
      startOpened: true,
      checkForm: (d, e) => {
        if (!d.kernel_id) e.kernel_id = 'Please enter a kernel name';
      },
    }
  );

  //

  useEffect(() => {
    if (!action.isOpened) {
      closeForm();
    }
  }, [action.isOpened]);

  //

  return (
    <DialogControlled
      title="New Kernel"
      description="Choose a name for the new kernel."
      open={action.isOpened}
      onOpenChange={action.close}
    >
      <FormError errors={action.errors} id="kernel_id" />

      <SelectFieldset
        name="kernel_id"
        value={action.formData.kernel_id}
        onChange={(v) => action.handleChange({ kernel_id: v })}
        placeholder="Kernel Id"
      >
        {Object.keys(jupyter?.kernels || {}).map((k) => (
          <SelectItem key={k} value={k}>
            {k.substring(0, 8)}{' '}
            <b>{jupyter!.kernels[k].notebooks.map((n) => n.path).join(', ')}</b>
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
          text="Create Kernel"
          loading={action.loading}
        />
      </div>
    </DialogControlled>
  );
};

//
