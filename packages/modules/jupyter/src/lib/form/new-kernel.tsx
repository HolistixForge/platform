import { useEffect } from 'react';

import {
  ButtonBase,
  FormError,
  FormErrors,
  TextFieldset,
  useAction,
  DialogControlled,
} from '@monorepo/ui-base';
import { useDispatcher, useSharedData } from '@monorepo/collab-engine';
import { TServersSharedData } from '@monorepo/servers';
import { TPosition } from '@monorepo/core';
import { TEventNewKernelNode } from '../jupyter-events';

/**
 *
 */

type NewKernelFormData = { kernelName: string };

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

  const sd = useSharedData<TServersSharedData>(['projectServers'], (sd) => sd);

  const action = useAction<NewKernelFormData>(
    (d) => {
      const server = sd.projectServers.get(`${project_server_id}`);
      if (server && server.type === 'jupyter') {
        return dispatcher.dispatch({
          type: 'jupyter:new-kernel-node',
          kernel_id: d.kernelName as string,
          project_server_id: server.project_server_id,
          origin: {
            viewId: viewId,
            position,
          },
        });
      } else throw new Error('No such server');
    },
    [dispatcher, position, project_server_id, sd.projectServers, viewId],
    {
      startOpened: true,
      checkForm: (d, e) => {
        if (!d.kernelName) e.kernelName = 'Please enter a kernel name';
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
      <FormError errors={action.errors} id="kernelName" />
      <TextFieldset
        label="Kernel Name"
        name="kernelName"
        onChange={action.handleInputChange}
        value={action.formData.kernelName}
        placeholder="Kernel Name"
      />

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
