import { stateToLabel, stateToProgress } from '../../front/jls-manager';
import './kernel-state-indicator.scss';

export type KernelStateIndicatorProps = {
  state: number;
};

const stateToColor = (state: number) => {
  switch (state) {
    case 0:
    case 1:
    case 2:
      return 'red';
    case 3:
    case 4:
    case 5:
      return 'orange';
    case 6:
      return 'green';
    default:
      return 'gray';
  }
};

export const KernelStateIndicator = ({ state }: KernelStateIndicatorProps) => {
  return (
    <div className="flex items-center gap-2">
      <div
        className="led"
        style={{ backgroundColor: stateToColor(state) }}
      ></div>
      <div className="kernel-ready-progress-bar">
        <div
          className="progress"
          style={{ width: `${stateToProgress(state)}%` }}
        ></div>
        <span>{stateToLabel(state)}</span>
      </div>
    </div>
  );
};
