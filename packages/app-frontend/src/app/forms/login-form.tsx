import { useApi, useMutationLogin } from '@holistix-forge/frontend-data';
import { useAction } from '@holistix-forge/ui-base';
import { SendMagicLinkForm, LoginForm } from '@holistix-forge/ui-views';
import { LoginFormData } from '@holistix-forge/frontend-data';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';

//
//

export const LoginFormLogic = ({
  githubLoginUrl,
  gitLabLoginUrl,
  linkedinLoginUrl,
  discordLoginUrl,
  local = true,
}: {
  githubLoginUrl?: string;
  gitLabLoginUrl?: string;
  linkedinLoginUrl?: string;
  discordLoginUrl?: string;
  local?: boolean;
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
        action={local ? action : undefined}
        gitLabLoginUrl={gitLabLoginUrl}
        githubLoginUrl={githubLoginUrl}
        linkedinLoginUrl={linkedinLoginUrl}
        discordLoginUrl={discordLoginUrl}
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
