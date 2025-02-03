import { ButtonBase } from '../../buttons/buttonBase';
import { TAction } from '../../buttons/useAction';
import { FormError, FormErrors } from '../form-errors/form-errors';
import { TextFieldset } from '../form-fields/text-fieldset';

export type NewPasswordFormData = {
  password: string;
};

export type NewPasswordFormProps = {
  action: TAction<NewPasswordFormData>;
};
export const NewPasswordForm = ({ action }: NewPasswordFormProps) => {
  return (
    <div style={{ width: '450px', margin: '50px auto', textAlign: 'center' }}>
      <h1>New Password</h1>

      <div className="login-form">
        {['password'].map((field) => (
          <div key={field}>
            <FormError errors={action.errors} id={field} />
            <TextFieldset
              label={field}
              name={field}
              onChange={action.handleInputChange}
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              value={(action.formData as any)[field]}
              placeholder={field}
              type="password"
            />
          </div>
        ))}

        <FormErrors errors={action.errors} />
        <div style={{ textAlign: 'center', marginTop: '45px' }}>
          <ButtonBase
            className="submit"
            callback={() => action.callback(action.formData)}
            text="Validate"
            loading={action.loading}
            disabled={action.disabled}
          />
        </div>
      </div>
    </div>
  );
};
