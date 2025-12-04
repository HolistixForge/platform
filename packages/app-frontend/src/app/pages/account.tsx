import { SendMagicLinkFormLogic, LoginFormLogic } from '../forms/login-form';
import { SignupFormLogic } from '../forms/signup-form';
import { TotpLoginFormLogic, TotpSetupFormLogic } from '../forms/totp-form';
import { useApi, useCurrentUser } from '@holistix-forge/frontend-data';
import { HeaderLogic } from '../header/header-logic';
import { useLocation } from 'react-router-dom';
import { ReactNode } from 'react';
import { NewPasswordFormLogic } from '../forms/password';

export const LoginPage = () => {
  const { accountFQDN } = useApi();

  return (
    <LoginFormLogic
      githubLoginUrl={`https://${accountFQDN}/github`}
      gitLabLoginUrl={`https://${accountFQDN}/gitlab`}
      linkedinLoginUrl={`https://${accountFQDN}/linkedin`}
      discordLoginUrl={`https://${accountFQDN}/discord`}
    />
  );
};

export const LoginLinkedinPage = () => {
  const { accountFQDN } = useApi();

  return (
    <LoginFormLogic
      local={false}
      linkedinLoginUrl={`https://${accountFQDN}/linkedin`}
    />
  );
};

export const ForgotPasswordPage = () => {
  return (
    <SendMagicLinkFormLogic
      email={undefined}
      title="Reset Password"
      context={'reset-password'}
    />
  );
};

export const SignupPage = () => {
  return <SignupFormLogic />;
};

export const AccountSettingsPage = () => {
  return (
    <>
      <HeaderLogic />
      <TotpSetupFormLogic />
    </>
  );
};

//
//
//

export const SimpleMessagePage = ({ message }: { message?: string }) => {
  const location = useLocation();

  // Extract the query parameter from the location
  const queryParams = new URLSearchParams(location.search);

  const messageParam = message || queryParams.get('message') || 'Sorry';

  return (
    <>
      <HeaderLogic />
      <p style={{ textAlign: 'center', fontSize: '16px' }}>{messageParam}</p>
    </>
  );
};

//
//
//

export const EnforceUserAccountReady = ({
  children,
}: {
  children: ReactNode;
}) => {
  const { data, status } = useCurrentUser();

  // if user data
  if (status === 'success') {
    // if user identified
    if (data.user.user_id) {
      // but email not validated
      /*
      TODO_EMAIL_VALIDATION: uncomment to enforce email validation before access to UI
      if (
        data.user.user_type === 'local' &&
        data.user.email_validated === false
      ) {
        return (
          <>
            <HeaderLogic />
            <SendMagicLinkFormLogic
              email={data.user.email}
              title="Validate email address"
              showForm={false}
              context={'validate-email'}
            />
          </>
        );
      }
      */

      if (data.user.totp_enabled && data.user.totp_last === null) {
        return <TotpLoginFormLogic />;
      }

      if (data.user.password_reset) {
        return <NewPasswordFormLogic />;
      }
    }
  }

  return children;
};
