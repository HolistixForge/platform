import {
  ButtonBase,
  FormError,
  FormErrors,
  TextFieldset,
  useAction,
  DialogControlled,
} from '@holistix-forge/ui-base';
import { TPosition } from '@holistix-forge/core-graph';
import { useDispatcher } from '@holistix-forge/reducers/frontend';
import { TEventSocials } from '../socials-events';
import { useEffect } from 'react';

/**
 *
 */

export interface NewIframeFormData {
  src: string;
}

/**
 *
 */

export const NewIframeForm = ({
  viewId,
  position,
  closeForm,
}: {
  viewId: string;
  position: TPosition;
  closeForm: () => void;
}) => {
  //

  const dispatcher = useDispatcher<TEventSocials>();

  const action = useAction<NewIframeFormData>(
    (d) => {
      return dispatcher.dispatch({
        type: 'socials:new-iframe',
        src: d.src,
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
        if (!d.src) e.src = 'Please enter the iframe source URL';
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
      title="New Iframe"
      description="Enter the URL to embed in the iframe"
      open={action.isOpened}
      onOpenChange={action.close}
    >
      <FormError errors={action.errors} id="src" />
      <TextFieldset
        label="URL"
        name="src"
        onChange={action.handleInputChange}
        value={action.formData.src}
        placeholder="https://example.com"
      />

      <FormErrors errors={action.errors} />
      <div
        style={{ display: 'flex', marginTop: 25, justifyContent: 'flex-end' }}
      >
        <ButtonBase
          className="submit"
          callback={() => action.callback(action.formData)}
          text="Embed Iframe"
          loading={action.loading}
        />
      </div>
    </DialogControlled>
  );
};
