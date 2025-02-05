import QRCode from 'react-qr-code';

import {
  TAction,
  SwitchFieldset,
  TextFieldset,
  TotpFieldset,
  FormError,
  FormErrors,
  ButtonBase,
} from '@monorepo/ui-base';
import { TotpEnableFormData, TotpLoginFormData } from '@monorepo/frontend-data';

import './totp.scss';

//

export type TotpSetupFormProps = {
  actionEnable: TAction<TotpEnableFormData>;
  actionLogin: TAction<TotpLoginFormData>;
  showKey: boolean;
  keyValue?: string;
  qrcodeUrl?: string;
};

export const TotpSetupForm = ({
  actionEnable,
  actionLogin,
  showKey,
  qrcodeUrl,
  keyValue,
}: TotpSetupFormProps) => {
  return (
    <div
      className="twofa-setup"
      style={{ width: '450px', margin: '50px auto' }}
    >
      <h1>Two-Factor Authentication (2FA) with TOTP</h1>

      <SwitchFieldset
        label={actionEnable.formData.enabled ? 'Enabled' : 'Enable'}
        name={'enabled'}
        value={actionEnable.formData.enabled}
        onChange={() => {
          actionEnable.callback(actionEnable.formData);
        }}
      />

      {showKey && qrcodeUrl && keyValue && (
        <>
          <div
            style={{
              background: 'white',
              padding: '16px',
              margin: '30px auto',
              width: 'fit-content',
              borderRadius: '15px',
            }}
          >
            <QRCode value={qrcodeUrl} />
          </div>

          <p className="section">
            Please save your private key in a safe place.
          </p>
          <TextFieldset
            name={'key'}
            value={keyValue}
            placeholder=""
            required={false}
            copyButton
          />

          <p className="section">Enter code to confirm 2FA TOTP setup.</p>
          <TotpLoginForm action={actionLogin} />
        </>
      )}
    </div>
  );
};

//
//

export type TotpLoginFormProps = {
  action: TAction<TotpLoginFormData>;
};

export const TotpLoginForm = ({ action }: TotpLoginFormProps) => {
  return (
    <div style={{ width: '450px', margin: '50px auto' }}>
      <FormError errors={action.errors} id={'code'} />
      <TotpFieldset
        label="Code"
        value={action.formData.code || ''}
        onChange={(s) => action.handleChange({ code: s })}
      />
      <FormErrors errors={action.errors} />
      <ButtonBase
        className="submit"
        callback={() => action.callback(action.formData)}
        text="Login"
        loading={action.loading}
      />
    </div>
  );
};
