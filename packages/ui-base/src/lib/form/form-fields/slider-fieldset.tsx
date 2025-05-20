import * as Slider from '@radix-ui/react-slider';
import { ReactNode } from 'react';

export type SliderFieldsetProps = {
  label?: string;
  name: string;
  value: number;
  onChange?: (value: number) => void;
  min?: number;
  max?: number;
  step?: number;
  required?: boolean;
  disabled?: boolean;
  children?: ReactNode;
  displayValue?: boolean;
  valueSuffix?: string;
  sliderWidth?: string;
};

export const SliderFieldset: React.FC<SliderFieldsetProps> = ({
  label,
  name,
  value,
  onChange,
  min = 1,
  max = 100,
  step = 1,
  required = true,
  disabled = false,
  children,
  displayValue = true,
  valueSuffix = '',
  sliderWidth = '230px',
}) => {
  return (
    <fieldset className="Fieldset slider">
      {label && (
        <label className={`Label ${required ? 'required' : ''}`} htmlFor={name}>
          {label} {required ? '*' : ''}
        </label>
      )}
      <Slider.Root
        style={{ width: sliderWidth, maxWidth: '230px' }}
        className="SliderRoot"
        value={[value]}
        onValueChange={(v: number[]) => {
          if (onChange) onChange(v[0]);
        }}
        min={min}
        max={max}
        step={step}
        disabled={disabled}
        name={name}
      >
        <Slider.Track className="SliderTrack">
          <Slider.Range className="SliderRange" />
        </Slider.Track>
        <Slider.Thumb className="SliderThumb" />
      </Slider.Root>
      {displayValue && (
        <span className="SliderValue">
          {value} {valueSuffix}
        </span>
      )}
      {children}
    </fieldset>
  );
};

export default SliderFieldset;
