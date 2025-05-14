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

export interface NewIframeFormData {
  src: string;
}

/**
 *
 */

export const NewIframeForm = ({
  action,
}: {
  action: TAction<NewIframeFormData>;
}) => {
  //

  return (
    <>
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
    </>
  );
};
