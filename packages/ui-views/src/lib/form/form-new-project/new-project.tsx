import {
  ButtonBase,
  TAction,
  FormError,
  FormErrors,
  TextFieldset,
} from '@monorepo/ui-base';
import { CheckIcon } from '@radix-ui/react-icons';
import * as Checkbox from '@radix-ui/react-checkbox';

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
      <fieldset className={`Fieldset text`}>
        <label className={`Label`} htmlFor={'public'}>
          Public ?
        </label>
        <Checkbox.Root
          className="CheckboxRoot"
          value={'gpuAccess'}
          checked={action.formData.public}
          id={'gpuAccess'}
          onCheckedChange={(v: boolean) =>
            action.handleChange({ public: v ? true : false })
          }
        >
          <Checkbox.Indicator className="CheckboxIndicator">
            <CheckIcon />
          </Checkbox.Indicator>
        </Checkbox.Root>
      </fieldset>

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
