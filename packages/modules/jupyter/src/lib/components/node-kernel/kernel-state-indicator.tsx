import './kernel-state-indicator.scss';

export type KernelStateIndicatorProps = {
  StartProgress: number;
  startState: string;
};

export const KernelStateIndicator = ({
  StartProgress,
  startState,
}: KernelStateIndicatorProps) => {
  return (
    <div className="kernel-ready-progress-bar">
      <div className="progress" style={{ width: `${StartProgress}%` }}></div>
      <span>{startState}</span>
    </div>
  );
};
