import { icons } from '@holistix-forge/ui-base';

export interface ReducedCellProps {
  type: 'normal' | 'validate' | 'error' | 'running' | 'selected' | 'glow';
}

export const ReducedCell = ({ type }: ReducedCellProps) => {
  return (
    <>
      {type === 'normal' ? (
        <icons.ReducedCellNormal />
      ) : type === 'validate' ? (
        <icons.ReducedCellValidate />
      ) : type === 'error' ? (
        <icons.ReducedCellError />
      ) : type === 'running' ? (
        <icons.ReducedCellRunning />
      ) : type === 'selected' ? (
        <div className="relative">
          <icons.SelectedOutline />
          <icons.ReducedCellNormal
            className="absolute"
            style={{
              left: '50%',
              top: '50%',
              transform: 'translate(-50%, -50%)',
            }}
          />
        </div>
      ) : type === 'glow' ? (
        <div className="relative">
          <div
            className="animate-ping"
            style={{
              height: '8.5px',
              width: '8.5px',
              borderRadius: '9999px',
              backgroundColor: 'var(--surface-300)',
            }}
          />
          <icons.ReducedCellNormal
            className="absolute"
            style={{
              left: '50%',
              top: '50%',
              transform: 'translate(-50%, -50%)',
            }}
          />
        </div>
      ) : null}
    </>
  );
};
