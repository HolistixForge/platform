import { useEffect } from 'react';

import {
  ButtonBase,
  useAction,
  DialogControlled,
  FormError,
  FormErrors,
  TextFieldset,
  SliderFieldset,
} from '@monorepo/ui-base';
import { useDispatcher } from '@monorepo/reducers/frontend';
import { TPosition } from '@monorepo/core-graph';

import { TServerEvents } from '../servers-events';

/**
 *
 */

export type NewVolumeFormData = { name: string; storage: number };

/**
 *
 */

export const NewVolumeForm = ({
  viewId,
  position,
  closeForm,
}: {
  viewId: string;
  position: TPosition;
  closeForm: () => void;
}) => {
  //

  const dispatcher = useDispatcher<TServerEvents>();

  const action = useAction<NewVolumeFormData>(
    (d) => {
      return dispatcher.dispatch({
        type: 'servers:new-volume',
        name: d.name as string,
        storage: d.storage as number,
        origin: {
          viewId: viewId,
          position,
        },
      });
    },
    [dispatcher, position, viewId],
    {
      startOpened: true,
      checkForm: (d, e) => {
        if (d.storage === undefined || d.storage < 0)
          e.storage = 'storage capacity must be greater than 0 Gi';
        else if (d.storage > 20)
          e.storage = 'storage capacity must be less than 20 Gi';
        if (!d.name) e.name = 'Please choose a name for the new volume';
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
      title="New Volume"
      description="Choose a name and storage capacity for your new volume."
      open={action.isOpened}
      onOpenChange={action.close}
    >
      <FormError errors={action.errors} id="name" />
      <TextFieldset
        label="Name"
        name="name"
        onChange={action.handleInputChange}
        value={action.formData.name}
        placeholder="Volume name"
      />
      <FormError errors={action.errors} id="imageId" />
      <SliderFieldset
        label="Storage (Gi)"
        name="storage"
        value={action.formData.storage}
        onChange={(v: number) => action.handleChange({ storage: v })}
        min={1}
        max={20}
        step={1}
        valueSuffix="Gi"
      />
      <FormErrors errors={action.errors} />
      <div
        style={{ display: 'flex', marginTop: 25, justifyContent: 'flex-end' }}
      >
        <ButtonBase
          className="submit"
          callback={() => action.callback(action.formData)}
          text="Create Volume"
          loading={action.loading}
        />
      </div>
    </DialogControlled>
  );
};
