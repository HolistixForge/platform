import {
  ButtonBase,
  DialogControlled,
  FormError,
  FormErrors,
  TextFieldset,
  useAction,
} from '@monorepo/ui-base';
import { TPosition } from '@monorepo/core-graph';
import { useDispatcher } from '@monorepo/reducers/frontend';
import { TEventSocials } from '../socials-events';
import { useEffect } from 'react';

/**
 *
 */

export interface NewYoutubeFormData {
  videoId: string;
}

/**
 *
 */

export const NewYoutubeForm = ({
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

  const action = useAction<NewYoutubeFormData>(
    (d) => {
      return dispatcher.dispatch({
        type: 'socials:new-youtube',
        videoId: d.videoId,
        origin: {
          viewId: viewId,
          position: position,
        },
      });
    },
    [dispatcher, position, viewId],
    {
      startOpened: true,
      checkForm: (d, e) => {
        if (!d.videoId) e.videoId = 'Please enter the youtube video Id';
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
      title="New Youtube video"
      description="Paste the video's id"
      open={action.isOpened}
      onOpenChange={action.close}
    >
      <FormError errors={action.errors} id="videoId" />
      <TextFieldset
        label="Video Id"
        name="videoId"
        onChange={action.handleInputChange}
        value={action.formData.videoId}
        placeholder="Video Id"
      />

      <FormErrors errors={action.errors} />
      <div
        style={{ display: 'flex', marginTop: 25, justifyContent: 'flex-end' }}
      >
        <ButtonBase
          className="submit"
          callback={() => action.callback(action.formData)}
          text="Embed Video"
          loading={action.loading}
        />
      </div>
    </DialogControlled>
  );
};
