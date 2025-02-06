import {
  InputsAndOutputs,
  TNodeContext,
  DisablePanSelect,
  NodeHeader,
  useMakeButton,
} from '@monorepo/space';
import { ButtonBase, ButtonBaseProps } from '@monorepo/ui-base';

import {
  KernelStateIndicator,
  KernelStateIndicatorProps,
} from './kernel-state-indicator';

//

export type NodeKernelProps = {
  state: 'kernel-started' | 'kernel-stopped' | 'server-stopped';
  kernelName: string;
  kernelType: string;
  startStopButton?: ButtonBaseProps;
  onDelete: () => Promise<void>;
} & Pick<
  TNodeContext,
  'id' | 'isOpened' | 'open' | 'close' | 'viewStatus' | 'expand' | 'reduce'
> &
  KernelStateIndicatorProps;

//
//

export const NodeKernel = ({
  id,
  open,
  close,
  isOpened,
  state,
  kernelName,
  kernelType,
  StartProgress,
  startState,
  startStopButton,
  onDelete,
  viewStatus,
  expand,
  reduce,
}: NodeKernelProps) => {
  //

  const isExpanded = viewStatus.mode === 'EXPANDED';
  const buttons = useMakeButton({
    isExpanded,
    expand,
    reduce,
    onDelete,
    isOpened,
    open,
    close,
  });

  return (
    <div className={`common-node kernel-node`}>
      <InputsAndOutputs id={id} />
      <NodeHeader
        nodeType="kernel"
        id={id}
        isOpened={isOpened}
        open={open}
        buttons={buttons}
      />
      {isOpened && (
        <DisablePanSelect>
          <div className="node-wrapper-body">
            <KernelStateIndicator
              startState={startState}
              StartProgress={StartProgress}
            />
            <div className="kernel-state-stopped">
              <p>
                kernel <b>{kernelName}</b>: {kernelType}
              </p>
              <span>
                {state === 'kernel-started'
                  ? 'started'
                  : state === 'kernel-stopped'
                  ? 'stopped'
                  : null}
              </span>
              {startStopButton && (
                <ButtonBase
                  {...startStopButton}
                  className="small blue"
                  style={{ marginLeft: '10px', width: '40px' }}
                />
              )}
            </div>
          </div>
        </DisablePanSelect>
      )}
    </div>
  );
};
