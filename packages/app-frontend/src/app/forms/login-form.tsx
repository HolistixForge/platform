import { useApi, useMutationLogin } from '@monorepo/frontend-data';
import { useAction } from '@monorepo/demiurge-ui-components';
import { SendMagicLinkForm, LoginForm } from '@monorepo/ui-views';
import { LoginFormData } from '@monorepo/frontend-data';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';

//
//

export const LoginFormLogic = ({
  githubLoginUrl,
  gitLabLoginUrl,
}: {
  githubLoginUrl: string;
  gitLabLoginUrl: string;
}) => {
  const login = useMutationLogin();

  const navigate = useNavigate();

  const action = useAction<LoginFormData>(
    (d) => login.mutateAsync(d).then(() => navigate('/')),
    [login, navigate]
  );

  return (
    <div>
      <LoginForm
        action={action}
        gitLabLoginUrl={gitLabLoginUrl}
        githubLoginUrl={githubLoginUrl}
      />
    </div>
  );
};

//
//

type MagicLinkContext = 'reset-password' | 'validate-email';

export const SendMagicLinkFormLogic = ({
  email,
  showForm = true,
  title,
  context,
}: {
  email: string | undefined;
  showForm?: boolean;
  title: string;
  context: MagicLinkContext;
}) => {
  const { accountApi } = useApi();

  const [message, setMessage] = useState('');

  const action = useAction<{
    email: string;
    context: MagicLinkContext;
  }>(
    (d, methods) =>
      accountApi
        .fetch({
          method: 'POST',
          url: 'magiclink/request',
          jsonBody: d,
        })
        .then(() => {
          methods.disable();
          setMessage('Check your inbox !');
        }),
    [accountApi],
    { values: { email, context } }
  );

  return (
    <div>
      <SendMagicLinkForm action={action} showForm={showForm} title={title} />
      <p style={{ textAlign: 'center' }}>{message}</p>
    </div>
  );
};
