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
              e.stopPropagation();
              !isDisabled && callback?.(e, actionOriginId);
            }}
            disabled={isDisabled}
            className={`transition-all ${className} ${isLoading ? 'button-loading' : ''} ${isDisabled ? 'disabled' : 'active'}`}
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
            <Tooltip.Content
              className="TooltipContent tooltip"
              sideOffset={12}
            >
              {tooltip}
              <Tooltip.Arrow className="TooltipArrow tooltip" />
            </Tooltip.Content>
          )}

          {errorsVisible && (
            <Tooltip.Content
              className="TooltipContent errors"
              sideOffset={12}
            >
              {errorsJoin(errors)}
              <Tooltip.Arrow className="TooltipArrow errors" />
            </Tooltip.Content>
          )}

          {successMessage && (
            <Tooltip.Content
              className="TooltipContent success"
              sideOffset={12}
            >
              {successMessage}
              <Tooltip.Arrow className="TooltipArrow success" />
            </Tooltip.Content>
          )}
        </>
      </Tooltip.Portal>
    </Tooltip.Root>
  );
};
