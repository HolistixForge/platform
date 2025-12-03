import {
  ButtonBase,
  TAction,
  FormError,
  FormErrors,
  TextFieldset,
} from '@holistix/ui-base';
import { NewPasswordFormData } from '@holistix/frontend-data';

//

export type NewPasswordFormProps = {
  action: TAction<NewPasswordFormData>;
};
export const NewPasswordForm = ({ action }: NewPasswordFormProps) => {
  return (
    <div
      style={{
        width: '450px',
        maxWidth: '100vw',
        margin: '50px auto',
        textAlign: 'center',
      }}
    >
      <h1>New Password</h1>

      <div className="login-form">
        {['password'].map((field) => (
          <div key={field}>
            <FormError errors={action.errors} id={field} />
            <TextFieldset
              label={field}
              name={field}
              onChange={action.handleInputChange}
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
