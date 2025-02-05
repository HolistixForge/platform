import { CSSProperties, ReactNode, forwardRef } from 'react';
import * as Select from '@radix-ui/react-select';
import { ChevronDownIcon, ChevronUpIcon } from '@radix-ui/react-icons';
import classnames from 'classnames';
import { CheckIcon } from '@radix-ui/react-icons';

export type SelectItemProps = {
  children: ReactNode;
  className?: string;
  value: string;
  disabled?: boolean;
  title?: string;
};

/**
 *
 */
export const SelectItem = forwardRef<HTMLDivElement, SelectItemProps>(
  ({ children, className, value, disabled = false, title }, forwardedRef) => {
    return (
      <Select.Item
        className={classnames('SelectItem', className)}
        value={value}
        disabled={disabled}
        ref={forwardedRef}
        title={title}
      >
        <Select.ItemText>{children}</Select.ItemText>
        <Select.ItemIndicator className="SelectItemIndicator">
          <CheckIcon />
        </Select.ItemIndicator>
      </Select.Item>
    );
  },
);

/**
 *
 */

export type SelectFieldsetProps = {
  label?: string;
  name: string;
  value: string;
  onChange: (v: string) => void;
  children: ReactNode;
  required?: boolean;
  placeholder: string;
  className?: string;
  integrated?: boolean;
  style?: CSSProperties;
};

export const SelectFieldset = ({
  value,
  onChange,
  label,
  name,
  children,
  required,
  placeholder,
  className,
  integrated,
  style,
}: SelectFieldsetProps) => {
  return (
    <fieldset
      className={`Fieldset select ${integrated ? 'integrated' : ''}`}
      style={{ margin: integrated ? 0 : undefined }}
    >
      {label && (
        <label htmlFor={name} className="Label">
          {label} {required ? '*' : ''}
        </label>
      )}
      <Select.Root
        value={value === undefined ? undefined : `${value}`}
        onValueChange={(v) => onChange(v)}
      >
        <Select.Trigger
          className={`SelectTrigger ${integrated ? 'integrated' : ''} ${className}`}
          aria-label={label}
          style={{ overflow: 'hidden', ...style }}
        >
          <Select.Value placeholder={placeholder} />
          <Select.Icon className="SelectIcon">
            <ChevronDownIcon />
          </Select.Icon>
        </Select.Trigger>
        <Select.Portal>
          <Select.Content className="SelectContent">
            <Select.ScrollUpButton className="SelectScrollButton">
              <ChevronUpIcon />
            </Select.ScrollUpButton>
            <Select.Viewport className="SelectViewport">
              {children}
            </Select.Viewport>
            <Select.ScrollDownButton className="SelectScrollButton">
              <ChevronDownIcon />
            </Select.ScrollDownButton>
          </Select.Content>
        </Select.Portal>
      </Select.Root>
    </fieldset>
  );
};
