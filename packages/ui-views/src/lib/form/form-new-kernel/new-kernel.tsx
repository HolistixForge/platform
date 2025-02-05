import {
  ButtonBase,
  TAction,
  FormError,
  FormErrors,
  TextFieldset,
} from '@monorepo/demiurge-ui-components';

/**
 *
 */

export type NewKernelFormData = { kernelName: string };

/**
 *
 */

export const NewKernelForm = ({
  action,
}: {
  action: TAction<NewKernelFormData>;
}) => {
  //

  return (
    <>
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
    </>
  );
};
