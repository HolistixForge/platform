import * as Popover from '@radix-ui/react-popover';
import * as Slider from '@radix-ui/react-slider';
import { useCallback, useState, useRef } from 'react';
import './color-picker.scss';

const COLORS = [
  '#FF0000',
  '#FF8A00',
  '#FFD600',
  '#00FF00',
  '#00FFE0',
  '#0066FF',
  '#7B00FF',
  '#FF00FF',
  '#FF0066',
  '#FFFFFF',
  '#000000',
  '#333333',
  '#666666',
  '#999999',
  '#CCCCCC',
];

export type ColorValue = {
  rgb: [number, number, number];
  rgba: string;
  hex: string;
  opacity: number;
};

interface ColorPickerProps {
  withTransparency?: boolean;
  initialColor?: string;
  initialOpacity?: number;
  onChange?: (value: ColorValue & { opacity: number }) => void;
  buttonTitle?: string;
}

const hexToRgb = (hex: string): [number, number, number] => {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  if (!result) return [0, 0, 0];
  return [
    parseInt(result[1], 16),
    parseInt(result[2], 16),
    parseInt(result[3], 16),
  ];
};

export const ColorPicker: React.FC<ColorPickerProps> = ({
  withTransparency = false,
  initialColor = '#FFFFFF',
  initialOpacity = 100,
  onChange,
  buttonTitle,
}) => {
  const [color, setColor] = useState(initialColor);
  const [opacity, setOpacity] = useState(initialOpacity);
  const customColorInputRef = useRef<HTMLInputElement>(null);

  const colorAllFormats = (c: string, o: number) => {
    const rgb = hexToRgb(c);
    return {
      rgb,
      rgba: `rgba(${rgb[0]}, ${rgb[1]}, ${rgb[2]}, ${o / 100})`,
      hex: c,
      opacity: o,
    };
  };

  const handleColorChange = useCallback(
    (newColor: string) => {
      setColor(newColor);
      onChange?.(colorAllFormats(newColor, opacity));
    },
    [onChange, opacity]
  );

  const handleOpacityChange = useCallback(
    (value: number[]) => {
      const newOpacity = value[0];
      setOpacity(newOpacity);
      onChange?.(colorAllFormats(color, newOpacity));
    },
    [onChange, color]
  );

  const handleCustomColorClick = useCallback(() => {
    customColorInputRef.current?.click();
  }, []);

  const handleCustomColorChange = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      const newColor = event.target.value;
      handleColorChange(newColor);
    },
    [handleColorChange]
  );

  return (
    <Popover.Root>
      <Popover.Trigger asChild>
        <button
          className="color-button"
          style={{
            backgroundColor: color,
            opacity: opacity / 100,
          }}
          title={buttonTitle}
        />
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content className="color-popover" sideOffset={5}>
          <div className="color-grid">
            {COLORS.map((colorOption) => (
              <div
                key={colorOption}
                className="color-option"
                style={{ backgroundColor: colorOption }}
                onClick={() => handleColorChange(colorOption)}
              />
            ))}
            <div
              className="color-option custom-color"
              onClick={handleCustomColorClick}
            >
              <span>+</span>
              <input
                ref={customColorInputRef}
                type="color"
                value={color}
                onChange={handleCustomColorChange}
              />
            </div>
          </div>
          {withTransparency && (
            <div className="opacity-slider">
              <Slider.Root
                style={{ width: '100%', maxWidth: '100%' }}
                className="SliderRoot"
                value={[opacity]}
                defaultValue={[1]}
                onValueChange={handleOpacityChange}
                min={0}
                max={100}
                step={1}
              >
                <Slider.Track className="SliderTrack">
                  <Slider.Range className="SliderRange" />
                </Slider.Track>
                <Slider.Thumb className="SliderThumb" />
              </Slider.Root>
            </div>
          )}
          <Popover.Arrow />
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
};
