import { UpdateIcon } from '@radix-ui/react-icons';
import * as Tooltip from '@radix-ui/react-tooltip';
import { CSSProperties, ReactNode } from 'react';
import { TAction } from './useAction';
import { errorsJoin } from '../form/form-errors/error-utils';

//
//

export type ButtonBaseProps = {
  className?: string;
  style?: CSSProperties;
  disabled?: boolean;
  actionOriginId?: string;
  Icon?: React.FC<{ style?: React.CSSProperties; className?: string }>;
  text?: string;
  children?: ReactNode;
  tooltip?: ReactNode;
  successMessage?: ReactNode;
  /**
   * What this button is called, when its face is an icon.
   *
   * Most buttons here render `Icon` with no `text`, so the accessible name is
   * empty and a screen reader announces "button" and nothing else. The tooltip
   * does not stand in for it: Radix shows it on hover and focus, but it is not
   * the button's name.
   */
  ariaLabel?: string;
  /**
   * For a button that is one of a set of choices, whether this is the chosen
   * one — the non-visual half of saying it with a colour or an opacity.
   */
  ariaPressed?: boolean;
  _testTooltip?: boolean;
} & Partial<TAction>;

//
//

export const ButtonBase = ({
  loading = false,
  callback,
  className,
  style,
  errors,
  disabled = false,
  actionOrigin,
  actionOriginId,
  Icon,
  text,
  children,
  tooltip,
  successMessage,
  ariaLabel,
  ariaPressed,
  _testTooltip,
}: ButtonBaseProps) => {
  //

  const isLoading =
    loading &&
    (actionOriginId === undefined || actionOriginId === actionOrigin);

  const isDisabled = disabled || isLoading;

  const errorsVisible =
    !isLoading &&
    errors &&
    Object.keys(errors).length > 0 &&
    (actionOriginId === undefined || actionOriginId === actionOrigin);

  return (
    <Tooltip.Root
      open={
        errorsVisible ||
        _testTooltip ||
        successMessage !== undefined ||
        undefined
      }
    >
      <Tooltip.Trigger asChild>
        <span className="button-root">
          <button
            onClick={(e) => {
              // Stopped here on purpose: these buttons sit inside cards that
              // are themselves clickable, and a click meant for the button
              // must not also open whatever it is drawn on.
              e.stopPropagation();
              if (!isDisabled) callback?.(e, actionOriginId);
            }}
            disabled={isDisabled}
            aria-label={ariaLabel}
            aria-pressed={ariaPressed}
            className={`transition-all ${className} ${
              isLoading ? 'button-loading' : ''
            } ${isDisabled ? 'disabled' : 'active'}`}
            style={style}
          >
            {isLoading && (
              <UpdateIcon
                className="button-loading"
                style={{ position: 'absolute' }}
              />
            )}

            <div
              style={{
                opacity: isLoading ? 0 : 1,
              }}
            >
              {text ? text : ''}
              {Icon && (
                <Icon
                  className="button-icon"
                  style={{ marginLeft: text ? '7px' : 0 }}
                />
              )}
              {children}
            </div>
          </button>
        </span>
      </Tooltip.Trigger>
      <Tooltip.Portal>
        <>
          {tooltip && !errorsVisible && !successMessage && (
            <Tooltip.Content className="TooltipContent tooltip" sideOffset={12}>
              {tooltip}
              <Tooltip.Arrow className="TooltipArrow tooltip" />
            </Tooltip.Content>
          )}

          {errorsVisible && (
            <Tooltip.Content className="TooltipContent errors" sideOffset={12}>
              {errorsJoin(errors)}
              <Tooltip.Arrow className="TooltipArrow errors" />
            </Tooltip.Content>
          )}

          {successMessage && (
            <Tooltip.Content className="TooltipContent success" sideOffset={12}>
              {successMessage}
              <Tooltip.Arrow className="TooltipArrow success" />
            </Tooltip.Content>
          )}
        </>
      </Tooltip.Portal>
    </Tooltip.Root>
  );
};
