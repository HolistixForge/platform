import {
  ButtonBase,
  TAction,
  FormError,
  FormErrors,
  TextFieldset,
} from '@monorepo/ui-base';
import { NewProjectFormData } from '@monorepo/frontend-data';

//

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
