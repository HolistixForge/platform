import { ButtonBase } from '../../buttons/buttonBase';
import { TAction } from '../../buttons/useAction';
import { FormError, FormErrors } from '../form-errors/form-errors';
import { TextFieldset } from '../form-fields/text-fieldset';

/**
 *
 */

export type MountVolumeFormData = {
  mount_point: string;
};

/**
 *
 */

export const MountVolumeForm = ({
  action,
}: {
  action: TAction<MountVolumeFormData>;
}) => {
  //

  return (
    <>
      <FormError errors={action.errors} id="mount_point" />
      <TextFieldset
        label="Mount point"
        name="mount_point"
        onChange={action.handleInputChange}
        value={action.formData.mount_point}
        placeholder="/mnt/foo"
      />

      <FormErrors errors={action.errors} />
      <div
        style={{ display: 'flex', marginTop: 25, justifyContent: 'flex-end' }}
      >
        <ButtonBase
          className="submit"
          callback={() => action.callback(action.formData)}
          text="Mount Volume"
          loading={action.loading}
        />
      </div>
    </>
  );
};
