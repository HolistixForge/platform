import {
  useCurrentUser,
  useMutationTotpLogin,
  useMutationTotpSetup,
} from '@monorepo/demiurge-data';
import {
  TotpSetupForm,
  TotpEnableFormData,
  TotpLoginFormData,
  useAction,
  TotpLoginForm,
} from '@monorepo/demiurge-ui-components';
import { useState } from 'react';

//
//

const useTotpLoginAction = () => {
  const totpLogin = useMutationTotpLogin();
  const action = useAction<TotpLoginFormData>(
    (d) => totpLogin.mutateAsync(d),
    [totpLogin],
    {
      checkForm: (d, e) => {
        const sixDigitRegex = /^\d{6}$/;
        if (!d.code || !sixDigitRegex.test(d.code))
          e.code = `code format must be 6 digits`;
      },
    },
  );
  return action;
};

//
//

type KeyData = {
  otpUrl: string;
  key: string;
};

export const TotpSetupFormLogic = () => {
  const { data, status } = useCurrentUser();

  const totp_enabled =
    status === 'success' && data.user.user_id ? data.user.totp_enabled : false;
  const totp_last =
    status === 'success' && data.user.user_id ? data.user.totp_last : null;

  const [keyData, setKeyData] = useState<KeyData | null>(null);

  const setup = useMutationTotpSetup();

  const actionEnable = useAction<TotpEnableFormData>(
    (d) =>
      setup.mutateAsync(d).then((json) => {
        setKeyData(json as KeyData);
        actionEnable.handleChange({ enabled: true });
      }),
    [setup],
    {
      // do action only when 'enabled' will change from false to true
      checkForm: (d, e) => {
        if (d.enabled !== false) e.global = 'nope';
      },
      values: { enabled: totp_enabled },
      resetOnSuccess: false,
    },
  );

  const actionValidate = useTotpLoginAction();

  return (
    <div>
      <TotpSetupForm
        actionEnable={actionEnable}
        actionLogin={actionValidate}
        showKey={totp_last === null}
        keyValue={keyData?.key}
        qrcodeUrl={keyData?.otpUrl}
      />
    </div>
  );
};

//
//
//

export const TotpLoginFormLogic = () => {
  const action = useTotpLoginAction();

  return <TotpLoginForm action={action} />;
};
