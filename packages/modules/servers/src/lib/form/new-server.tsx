import * as Select from '@radix-ui/react-select';

import { useQueryServerImages } from '@monorepo/frontend-data';
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
import { useDispatcher } from '@monorepo/collab-engine';

import { TServerEvents } from '../servers-events';
import { TPosition } from '@monorepo/core';
import { useEffect } from 'react';

/**
 *
 */

export type NewServerFormData = {
  imageId: number | undefined;
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

  const { status, data: images } = useQueryServerImages();

  const dispatcher = useDispatcher<TServerEvents>();

  const action = useAction<NewServerFormData>(
    (d) => {
      return dispatcher.dispatch({
        type: 'servers:new',
        from: {
          new: {
            serverName: d.serverName as string,
            imageId: d.imageId as number,
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
        if (d.imageId === undefined) e.imageId = 'Please select a server image';
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
  }, [action.isOpened]);

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
        value={`${action.formData.imageId}`}
        onChange={(s) => action.handleChange({ imageId: parseInt(s) })}
        placeholder="Select a server image…"
        label="Image"
        required
      >
        <Select.Group>
          <Select.Label className="SelectLabel">Images</Select.Label>
          {status === 'success' &&
            images &&
            images._0.map((i) => (
              <SelectItem
                key={i.image_id}
                value={`${i.image_id}`}
                title={`${i.image_sha256?.substring(0, 10)}...`}
              >
                {i.image_name}: {i.image_tag}
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
