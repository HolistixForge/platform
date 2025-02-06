import {
  ButtonBase,
  TAction,
  FormError,
  FormErrors,
  TextFieldset,
} from '@monorepo/ui-base';

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
  action,
}: {
  action: TAction<NewYoutubeFormData>;
}) => {
  //

  return (
    <>
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
    </>
  );
};
