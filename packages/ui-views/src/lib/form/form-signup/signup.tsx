import { Link } from 'react-router-dom';
import { FormError, FormErrors } from '../form-errors/form-errors';
import { TextFieldset } from '../form-fields/text-fieldset';
import { TAction } from '../../buttons/useAction';
import { ButtonBase } from '../../buttons/buttonBase';

/**
 *
 */

export type SignupFormData = {
  email: string;
  password: string;
  username: string;
  firstname: string;
  lastname: string;
};

/**
 *
 */
//
//

export type SignupFormProps = {
  action: TAction<SignupFormData>;
};

export const SignupForm = ({ action }: SignupFormProps) => {
  //

  return (
    <div style={{ width: '450px', margin: '50px auto', textAlign: 'center' }}>
      <h1>Signup</h1>
      {['email', 'password', 'username', 'firstname', 'lastname'].map(
        (field) => (
          <div key={field}>
            <FormError errors={action.errors} id={field} />
            <TextFieldset
              label={field}
              name={field}
              onChange={action.handleInputChange}
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              value={(action.formData as any)[field]}
              placeholder={field}
              type={
                field === 'password'
                  ? 'password'
                  : field === 'email'
                    ? 'email'
                    : 'text'
              }
              required={['email', 'password', 'username'].includes(field)}
            />
          </div>
        ),
      )}

      <FormErrors errors={action.errors} />
      <div
        style={{ display: 'flex', marginTop: 25, justifyContent: 'flex-end' }}
      >
        <ButtonBase
          className="submit"
          callback={() => action.callback(action.formData)}
          text="Signup"
          loading={action.loading}
        />
      </div>

      <Link to="/account/login">
        <div className="signup-link">
          Already have an account ? <b>Login</b>
        </div>
      </Link>
    </div>
  );
};
