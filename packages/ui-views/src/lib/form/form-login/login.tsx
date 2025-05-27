import { Link } from 'react-router-dom';
import { GitHubLogoIcon } from '@radix-ui/react-icons';

import {
  FormError,
  FormErrors,
  TextFieldset,
  TAction,
  icons,
  ButtonBase,
} from '@monorepo/ui-base';

import { LoginFormData } from '@monorepo/frontend-data';

import './login.scss';

//

export type LoginFormProps = {
  action: TAction<LoginFormData>;
  githubLoginUrl: string;
  gitLabLoginUrl: string;
  linkedinLoginUrl: string;
  discordLoginUrl: string;
};

export const LoginForm = ({
  action,
  githubLoginUrl,
  gitLabLoginUrl,
  linkedinLoginUrl,
  discordLoginUrl,
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

        <div>
          <a href={linkedinLoginUrl}>
            <svg
              className="provider-logo linkedin"
              width="24"
              height="24"
              viewBox="0 0 24 24"
              fill="currentColor"
            >
              <path d="M19 0h-14c-2.761 0-5 2.239-5 5v14c0 2.761 2.239 5 5 5h14c2.762 0 5-2.239 5-5v-14c0-2.761-2.238-5-5-5zm-11 19h-3v-10h3v10zm-1.5-11.268c-.966 0-1.75-.784-1.75-1.75s.784-1.75 1.75-1.75 1.75.784 1.75 1.75-.784 1.75-1.75 1.75zm13.5 11.268h-3v-5.604c0-1.337-.025-3.063-1.868-3.063-1.868 0-2.154 1.459-2.154 2.968v5.699h-3v-10h2.881v1.367h.041c.401-.761 1.379-1.563 2.841-1.563 3.039 0 3.6 2.001 3.6 4.601v5.595z" />
            </svg>
            <br />
            <span>Login with LinkedIn</span>
          </a>
        </div>

        <div>
          <a href={discordLoginUrl}>
            <svg
              className="provider-logo discord"
              width="24"
              height="24"
              viewBox="0 0 71 55"
              fill="currentColor"
            >
              <path d="M60.104 4.552A58.864 58.864 0 0 0 46.852.8a.117.117 0 0 0-.124.06c-2.048 3.614-4.332 8.32-5.938 12.06-7.112-1.07-14.1-1.07-21.084 0-1.606-3.74-3.89-8.446-5.938-12.06A.117.117 0 0 0 13.148.8a58.96 58.96 0 0 0-13.252 3.752.105.105 0 0 0-.048.041C.16 18.08-.32 31.293.152 44.43a.112.112 0 0 0 .042.082c5.58 4.09 11.02 6.58 16.38 8.23a.115.115 0 0 0 .124-.042c1.26-1.73 2.38-3.56 3.34-5.51a.112.112 0 0 0-.065-.155c-1.8-.68-3.51-1.5-5.18-2.47a.117.117 0 0 1-.012-.194c.348-.263.696-.53 1.03-.8a.112.112 0 0 1 .114-.013c10.84 4.95 22.57 4.95 33.36 0a.112.112 0 0 1 .116.012c.334.27.682.537 1.03.8a.117.117 0 0 1-.01.194c-1.67.97-3.38 1.79-5.18 2.47a.112.112 0 0 0-.065.155c.96 1.95 2.08 3.78 3.34 5.51a.115.115 0 0 0 .124.042c5.36-1.65 10.8-4.14 16.38-8.23a.112.112 0 0 0 .042-.082c.5-13.137.02-26.35-2.98-39.837a.105.105 0 0 0-.048-.041ZM23.725 37.07c-3.23 0-5.88-2.97-5.88-6.63 0-3.66 2.62-6.63 5.88-6.63 3.28 0 5.92 2.99 5.88 6.63 0 3.66-2.62 6.63-5.88 6.63Zm23.55 0c-3.23 0-5.88-2.97-5.88-6.63 0-3.66 2.62-6.63 5.88-6.63 3.28 0 5.92 2.99 5.88 6.63 0 3.66-2.62 6.63-5.88 6.63Z" />
            </svg>
            <br />
            <span>Login with Discord</span>
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
