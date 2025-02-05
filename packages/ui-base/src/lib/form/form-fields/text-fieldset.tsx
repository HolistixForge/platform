import { CopyIcon } from '@radix-ui/react-icons';
import { copyToClipboard } from '../../utils/copy-to-clipboard';
import { ReactNode } from 'react';

export type TextFieldsetProps = {
  label?: string;
  name: string;
  onChange?: (e: React.ChangeEvent<HTMLInputElement>) => void;
  value: string;
  type?: 'text' | 'password' | 'email' | 'number';
  placeholder: string;
  required?: boolean;
  disabled?: boolean;
  copyButton?: boolean;
  children?: ReactNode;
  min?: number;
  max?: number;
  step?: number;
};

export const TextFieldset = ({
  label,
  name,
  onChange,
  value,
  type = 'text',
  placeholder,
  required = true,
  disabled = false,
  copyButton = false,
  children,
  min,
  max,
  step,
}: TextFieldsetProps) => {
  return (
    <fieldset
      className={`Fieldset text ${copyButton ? 'with-copy-button' : ''}`}
    >
      {label && (
        <label className={`Label ${required ? 'required' : ''}`} htmlFor={name}>
          {label} {required ? '*' : ''}
        </label>
      )}

      <div style={{ width: '100%', position: 'relative' }}>
        <div
          style={{
            position: 'absolute',
            top: 0,
            bottom: 0,
            width: 0,
          }}
        >
          {children}
        </div>

        <input
          className={`Input`}
          type={type}
          id={name}
          name={name}
          value={value || ''}
          placeholder={placeholder}
          onChange={onChange}
          disabled={disabled}
          min={min}
          max={max}
          step={step}
        />
      </div>

      {copyButton && (
        <button onClick={() => copyToClipboard(value)}>
          <CopyIcon style={{ color: 'var(--c-pink-1)' }} />
        </button>
      )}
    </fieldset>
  );
};
