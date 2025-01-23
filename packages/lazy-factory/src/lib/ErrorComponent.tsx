import { useCallback } from 'react';
import { ComponentProps, EComponentMode, TFactoryComponent } from './types';

export const withFactoryError = (
  WrappedComponent: TFactoryComponent,
  acceptedMode: Array<EComponentMode>,
  error: Error
) => {
  return (props: object) => {
    return (
      <WrappedComponent
        {...props}
        _factoryError={error}
        _acceptedMode={acceptedMode}
      />
    );
  };
};

const DomErrorComponent = ({
  message,
  handleClick,
}: {
  message: string;
  handleClick: () => void;
}) => {
  return (
    <div
      onClick={handleClick}
      style={{
        padding: '20px',
        width: '150px',
        height: '100px',
        overflow: 'scroll-y',
        overflowWrap: 'break-word',
        color: 'var(--c-gray-3)',
        fontSize: '8px',
        backgroundColor: 'var(--color-error)',
      }}
    >
      {message}
    </div>
  );
};

// TODO_NOW: ErrorComponent must be overidable by factory user

export const ErrorComponent = ({
  mode,
  _factoryError = new Error(''),
  _acceptedMode,
}: ComponentProps) => {
  const handleClick = useCallback(() => {
    console.error(_factoryError);
    alert(_factoryError.message);
  }, [_factoryError]);

  if (_acceptedMode) {
    for (mode of _acceptedMode) {
      if (mode === 'DOM')
        return (
          <DomErrorComponent
            message={_factoryError.message}
            handleClick={handleClick}
          />
        );
    }
  }

  return (
    <DomErrorComponent
      message={_factoryError.message}
      handleClick={handleClick}
    />
  );
};
