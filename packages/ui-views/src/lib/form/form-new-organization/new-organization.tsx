import {
  ButtonBase,
  TAction,
  FormError,
  FormErrors,
  TextFieldset,
} from '@holistix-forge/ui-base';

import { NewOrganizationFormData } from '@holistix-forge/frontend-data';

//

export const NewOrganizationForm = ({
  action,
}: {
  action: TAction<NewOrganizationFormData>;
}) => {
  //

  return (
    <>
      <FormError errors={action.errors} id="name" />
      <TextFieldset
        label="Organization Name"
        name="name"
        onChange={action.handleInputChange}
        value={action.formData.name}
        placeholder="Organization Name"
      />

      <FormErrors errors={action.errors} />
      <div
        style={{ display: 'flex', marginTop: 25, justifyContent: 'flex-end' }}
      >
        <ButtonBase
          className="submit"
          callback={() => action.callback(action.formData)}
          text="Create Organization"
          loading={action.loading}
        />
      </div>
    </>
  );
};

