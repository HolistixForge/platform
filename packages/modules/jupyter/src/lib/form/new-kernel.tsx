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
import { TEventNewKernelNode } from '../jupyter-events';
import { TJupyterSharedData } from '../jupyter-shared-model';
import { TJupyterServerData } from '../jupyter-types';
import { useJLsManager } from '../jupyter-hooks';
import {
  TUserContainer,
  TUserContainersSharedData,
} from '@holistix/user-containers';

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
  user_container_id: string;
  position: TPosition;
  viewId: string;
  closeForm: () => void;
}) => {
  //

  const dispatcher = useDispatcher<TEventNewKernelNode>();

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
  }, [action.isOpened, closeForm]);

  //

  if (!jupyter) return null;

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
            <b>{jupyter.kernels[k].notebooks.map((n) => n.path).join(', ')}</b>
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
