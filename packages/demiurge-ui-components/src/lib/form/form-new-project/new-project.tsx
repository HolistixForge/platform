import { ButtonBase } from '../../buttons/buttonBase';
import { TAction } from '../../buttons/useAction';
import { FormError, FormErrors } from '../form-errors/form-errors';
import { TextFieldset } from '../form-fields/text-fieldset';

/**
 *
 */

export type NewProjectFormData = { name: string };

/**
 *
 */

export const NewProjectForm = ({
  action,
}: {
  action: TAction<NewProjectFormData>;
}) => {
  //

  return (
    <>
      <FormError errors={action.errors} id="name" />
      <TextFieldset
        label="Project Name"
        name="name"
        onChange={action.handleInputChange}
        value={action.formData.name}
        placeholder="Project Name"
      />

      <FormErrors errors={action.errors} />
      <div
        style={{ display: 'flex', marginTop: 25, justifyContent: 'flex-end' }}
      >
        <ButtonBase
          className="submit"
          callback={() => action.callback(action.formData)}
          text="Create Project"
          loading={action.loading}
        />
      </div>
    </>
  );
};
