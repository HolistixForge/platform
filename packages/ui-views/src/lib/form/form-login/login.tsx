import { Link } from 'react-router-dom';
import { GitHubLogoIcon } from '@radix-ui/react-icons';

import {
  FormError,
  FormErrors,
  TextFieldset,
  TAction,
  icons,
  ButtonBase,
} from '@monorepo/demiurge-ui-components';

import { LoginFormData } from '@monorepo/frontend-data';

import './login.scss';

//

export type LoginFormProps = {
  action: TAction<LoginFormData>;
  githubLoginUrl: string;
  gitLabLoginUrl: string;
};

export const LoginForm = ({
  action,
  githubLoginUrl,
  gitLabLoginUrl,
}: LoginFormProps) => {
  //

  return (
    <div style={{ width: '450px', margin: '50px auto', textAlign: 'center' }}>
      <h1>Login</h1>

      <div className="providers">
        <div>
          <a href={githubLoginUrl}>
            <GitHubLogoIcon className="provider-logo" />
            <br />
            <span>Login with GitHub</span>
          </a>
        </div>

        <div>
          <a href={gitLabLoginUrl}>
            <icons.Gitlab className="provider-logo gitlab" />
            <br />
            <span>Login with GitLab</span>
          </a>
        </div>
      </div>

      <div className="login-form">
        {['email', 'password'].map((field) => (
          <div key={field}>
            <FormError errors={action.errors} id={field} />
            <TextFieldset
              label={field}
              name={field}
              onChange={action.handleInputChange}
              value={(action.formData as any)[field]}
              placeholder={field}
              type={
                field === 'password'
                  ? 'password'
                  : field === 'email'
                  ? 'email'
                  : 'text'
              }
            />
          </div>
        ))}

        <FormErrors errors={action.errors} />
        <div
          style={{ display: 'flex', marginTop: 25, justifyContent: 'flex-end' }}
        >
          <ButtonBase
            className="submit"
            callback={() => action.callback(action.formData)}
            text="Login"
            loading={action.loading}
          />
        </div>

        <Link to="/account/forgot-password">
          <div className="">Forgot password?</div>
        </Link>
      </div>

      <Link to="/account/signup">
        <div className="signup-link">Create account</div>
      </Link>
    </div>
  );
};

//
//

export type SendMagicLinkFormProps = {
  action: TAction<any>;
  showForm: boolean;
  title: string;
};

export const SendMagicLinkForm = ({
  action,
  showForm,
  title,
}: SendMagicLinkFormProps) => {
  //
  return (
    <div style={{ width: '450px', margin: '50px auto', textAlign: 'center' }}>
      <h1>{title}</h1>

      <div className="login-form">
        {showForm &&
          ['email'].map((field) => (
            <div key={field}>
              <FormError errors={action.errors} id={field} />
              <TextFieldset
                label={field}
                name={field}
                onChange={action.handleInputChange}
                value={(action.formData as any)[field]}
                placeholder={field}
                type="email"
              />
            </div>
          ))}

        <FormErrors errors={action.errors} />
        <div style={{ textAlign: 'center', marginTop: showForm ? '45px' : 0 }}>
          <ButtonBase
            className="submit"
            callback={() => action.callback(action.formData)}
            text="Send Link"
            loading={action.loading}
            disabled={action.disabled}
          />
        </div>
      </div>
    </div>
  );
};
