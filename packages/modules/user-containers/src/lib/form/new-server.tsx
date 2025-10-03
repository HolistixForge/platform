import * as Select from '@radix-ui/react-select';

import {
  ButtonBase,
  FormError,
  FormErrors,
  SelectFieldset,
  SelectItem,
  TextFieldset,
  useAction,
  DialogControlled,
} from '@monorepo/ui-base';
import { useDispatcher, useSharedData } from '@monorepo/collab-engine';

import { TServerEvents } from '../servers-events';
import { TServersSharedData } from '../servers-shared-model';
import { TPosition } from '@monorepo/core-graph';
import { useEffect } from 'react';

/**
 *
 */

export type NewServerFormData = {
  imageId: string;
  serverName: string;
};

/**
 *
 */

export const NewServerForm = ({
  viewId,
  position,
  closeForm,
}: {
  position?: TPosition;
  viewId?: string;
  closeForm: () => void;
}) => {
  //

  const containerImages = useSharedData<TServersSharedData>(
    ['containerImages'],
    (sd) => sd.containerImages
  );

  const dispatcher = useDispatcher<TServerEvents>();

  const action = useAction<NewServerFormData>(
    (d) => {
      return dispatcher.dispatch({
        type: 'servers:new',
        from: {
          new: {
            serverName: d.serverName,
            imageId: d.imageId,
          },
        },
        origin:
          viewId && position
            ? {
                viewId: viewId,
                position,
              }
            : undefined,
      });
    },
    [dispatcher, position, viewId],
    {
      startOpened: true,
      checkForm: (d, e) => {
        if (!d.imageId) e.imageId = 'Please select a server image';
        if (!d.serverName)
          e.serverName = 'Please choose a name for the new server';
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

  return (
    <DialogControlled
      title="New Server"
      description="Choose a name and select an image for your new server."
      open={action.isOpened}
      onOpenChange={action.close}
    >
      <FormError errors={action.errors} id="serverName" />
      <TextFieldset
        label="Name"
        name="serverName"
        onChange={action.handleInputChange}
        value={action.formData.serverName}
        placeholder="Server name"
      />

      <FormError errors={action.errors} id="imageId" />
      <SelectFieldset
        name="imageId"
        value={action.formData.imageId || ''}
        onChange={(s) => action.handleChange({ imageId: s })}
        placeholder="Select a server image…"
        label="Image"
        required
      >
        <Select.Group>
          <Select.Label className="SelectLabel">Images</Select.Label>
          {containerImages &&
            Array.from(containerImages).map((img: any) => (
              <SelectItem
                key={img.imageId}
                value={img.imageId}
                title={img.description || ''}
              >
                {img.imageName}
              </SelectItem>
            ))}
        </Select.Group>
      </SelectFieldset>

      <FormErrors errors={action.errors} />
      <div
        style={{ display: 'flex', marginTop: 25, justifyContent: 'flex-end' }}
      >
        <ButtonBase
          className="submit"
          callback={() => action.callback(action.formData)}
          text="Create server"
          loading={action.loading}
        />
      </div>
    </DialogControlled>
  );
};
