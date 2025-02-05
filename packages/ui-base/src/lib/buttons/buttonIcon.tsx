import { CSSProperties } from 'react';
import { ButtonBase, ButtonBaseProps } from './buttonBase';

export type ButtonIconProps = ButtonBaseProps & {
  iconWidth?: string;
  iconHeight?: string;
};

//

export const ButtonIcon = ({
  iconWidth,
  iconHeight,
  ...others
}: ButtonIconProps) => {
  return (
    <ButtonBase
      {...others}
      className={`icon ${others.className}`}
      style={
        {
          '--icon-width': iconWidth,
          '--icon-height': iconHeight,
        } as CSSProperties
      }
    />
  );
};
