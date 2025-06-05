import { stateToLabel, stateToProgress } from '../../front/jls-manager';
import './kernel-state-indicator.scss';

export type KernelStateIndicatorProps = {
  state: number;
};

export const KernelStateIndicator = ({ state }: KernelStateIndicatorProps) => {
  return (
    <div className="kernel-ready-progress-bar">
      <div
        className="progress"
        style={{ width: `${stateToProgress(state)}%` }}
      ></div>
      <span>{stateToLabel(state)}</span>
    </div>
  );
};
