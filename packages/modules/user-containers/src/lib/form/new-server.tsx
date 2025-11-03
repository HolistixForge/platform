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
import { useLocalSharedData } from '@monorepo/collab/frontend';
import { useDispatcher } from '@monorepo/reducers/frontend';

import { TUserContainersEvents } from '../servers-events';
import { TUserContainersSharedData } from '../servers-shared-model';
import { TPosition } from '@monorepo/core-graph';
import { useEffect } from 'react';
import { TContainerImageInfo } from '../container-image';

/**
 *
 */

export type NewContainerFormData = {
  imageId: string;
  containerName: string;
};

/**
 *
 */

export const NewContainerForm = ({
  viewId,
  position,
  closeForm,
}: {
  position?: TPosition;
  viewId?: string;
  closeForm: () => void;
}) => {
  //

  const containerImages: Map<string, TContainerImageInfo> =
    useLocalSharedData<TUserContainersSharedData>(
      ['user-containers:images'],
      (sd) => sd['user-containers:images']
    );

  const dispatcher = useDispatcher<TUserContainersEvents>();

  const action = useAction<NewContainerFormData>(
    (d) => {
      return dispatcher.dispatch({
        type: 'user-container:new',
        containerName: d.containerName,
        imageId: d.imageId,
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
        if (!d.imageId) e.imageId = 'Please select a container image';
        if (!d.containerName)
          e.containerName = 'Please choose a name for the new container';
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
      title="New Container"
      description="Choose a name and select an image for your new container."
      open={action.isOpened}
      onOpenChange={action.close}
    >
      <FormError errors={action.errors} id="containerName" />
      <TextFieldset
        label="Name"
        name="containerName"
        onChange={action.handleInputChange}
        value={action.formData.containerName}
        placeholder="Container name"
      />

      <FormError errors={action.errors} id="imageId" />
      <SelectFieldset
        name="imageId"
        value={action.formData.imageId || ''}
        onChange={(s) => action.handleChange({ imageId: s })}
        placeholder="Select a container image…"
        label="Image"
        required
      >
        <Select.Group>
          <Select.Label className="SelectLabel">Images</Select.Label>
          {containerImages &&
            Array.from(containerImages.values()).map(
              (img: TContainerImageInfo) => (
                <SelectItem
                  key={img.imageId}
                  value={img.imageId}
                  title={img.description || ''}
                >
                  {img.imageName}
                </SelectItem>
              )
            )}
        </Select.Group>
      </SelectFieldset>

      <FormErrors errors={action.errors} />
      <div
        style={{ display: 'flex', marginTop: 25, justifyContent: 'flex-end' }}
      >
        <ButtonBase
          className="submit"
          callback={() => action.callback(action.formData)}
          text="Create container"
          loading={action.loading}
        />
      </div>
    </DialogControlled>
  );
};
