import { TJsonObject } from '@monorepo/simple-types';

import { useMakeButton, NodeHeader, DisablePanSelect } from '..';
import { InputsAndOutputs } from '../reactflow-renderer/assets/inputsOutputs/inputsOutputs';
import { useNodeContext } from '../reactflow-renderer/node-wrappers/node-wrapper';

//

export const CustomStoryNode = ({
  data,
  type,
}: {
  data?: TJsonObject;
  type?: string;
}) => {
  const nc = useNodeContext();

  const { close, expand, reduce, isOpened, viewStatus } = nc;

  const isExpanded = viewStatus.mode === 'EXPANDED';

  const buttons = useMakeButton({
    isExpanded,
    expand,
    reduce,
    isOpened,
    open,
    close,
  });
  return (
    <div style={{ width: isExpanded ? '250px' : '100px' }}>
      <InputsAndOutputs id={nc.id} />
      <NodeHeader
        nodeType={type || 'default'}
        id={nc.id}
        isOpened={nc.isOpened}
        open={nc.open}
        buttons={buttons}
      />
      {isOpened && data && isExpanded && (
        <DisablePanSelect>
          <div className="node-wrapper-body">
            <pre>{JSON.stringify(data, null, 2)}</pre>
            {/*
              <IncomingEdgeHandles />
              <OutgoingEdgeHandles />
              */}
          </div>
        </DisablePanSelect>
      )}
    </div>
  );
};
