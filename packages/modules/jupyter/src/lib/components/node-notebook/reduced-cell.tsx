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
          <icons.ReducedCellNormal className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2" />
        </div>
      ) : type === 'glow' ? (
        <div className="relative">
          <div className="-bg--c-blue-3 animate-ping h-[8.5px] w-[8.5px] rounded-full" />
          <icons.ReducedCellNormal className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2" />
        </div>
      ) : null}
    </>
  );
};
