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
  //

  const dispatcher = useDispatcher<TEventNewKernelNode>();

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

  const action = useAction<NewKernelFormData>(
    (d) => {
      if (jupyter) {
        return dispatcher.dispatch({
          type: 'jupyter:new-kernel-node',
          kernel_id: d.kernel_id as string,
          project_server_id: project_server_id,
          origin: {
            viewId: viewId,
            position,
          },
        });
      } else throw new Error('No such server');
    },
    [dispatcher, position, project_server_id, jupyter, viewId],
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
