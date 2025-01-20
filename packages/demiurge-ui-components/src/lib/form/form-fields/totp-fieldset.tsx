import { EraserIcon } from '@radix-ui/react-icons';
import { ClipboardEvent, createRef, useMemo } from 'react';

import './totp-fieldset.scss';

export type TotpFieldsetProps = {
  value: string;
  onChange: (value: string) => void;
  length?: number;
  label?: string;
};

//
//

export const TotpFieldset: React.FC<TotpFieldsetProps> = ({
  label,
  value,
  onChange,
  length = 6,
}) => {
  const refs = useMemo(
    () =>
      Array(length)
        .fill(1)
        .map((_, i) => createRef<HTMLInputElement>()),
    [length]
  );

  const handleChange = (index: number, newValue: string) => {
    const newToken = value.split('');
    newToken[index] = newValue;
    onChange(newToken.join(''));
  };

  const handlePaste = (e: ClipboardEvent<HTMLInputElement>) => {
    e.preventDefault();
    const pastedData = e.clipboardData.getData('text');
    if (new RegExp(`^\\d{${length}}$`).test(pastedData)) {
      onChange(pastedData);
    }
  };

  const handleKeyPress = (
    index: number,
    e: React.KeyboardEvent<HTMLInputElement>
  ) => {
    if (e.key.match(/^\d$/)) {
      handleChange(index, e.key);
      const r = refs[index + 1];
      if (index < 5 && r && r.current) {
        r.current.focus();
      }
    } else if (e.key === 'Backspace') {
      handleChange(index, '');
      const r = refs[index - 1];
      if (index > 0 && r && r.current) {
        r.current.focus();
      }
    }
  };

  return (
    <fieldset className="Fieldset totp-fieldset">
      {label && <label className={`Label`}>{label}</label>}
      <div className="totp-grid">
        {refs.map((r, k) => (
          <div key={k}>
            <input
              type="text"
              className={`Input totp-digit`}
              maxLength={1}
              value={value[k] || ''}
              onChange={
                () => null
                //handleChange(k, e.target.value)
              }
              onKeyDown={(e: React.KeyboardEvent<HTMLInputElement>) =>
                handleKeyPress(k, e)
              }
              onPaste={handlePaste}
              ref={r}
            />
          </div>
        ))}
        <div>
          <button className="button-clear" onClick={() => onChange('')}>
            <EraserIcon />
          </button>
        </div>
      </div>
    </fieldset>
  );
};
