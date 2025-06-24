import { TJsonObject } from '@monorepo/simple-types';

import { InputsAndOutputs } from './assets/inputsOutputs/inputsOutputs';
import { useNodeContext } from './node-wrappers/node-wrapper';
import { NodeHeader } from './assets/node-header/node-header';
import { useNodeHeaderButtons } from './assets/node-header/node-main-toolbar';

//

export const CustomStoryNode = ({
  data,
  type,
}: {
  data?: TJsonObject;
  type?: string;
}) => {
  const nc = useNodeContext();

  const { isOpened, viewStatus, selected } = nc;

  const isExpanded = viewStatus.mode === 'EXPANDED';

  const buttons = useNodeHeaderButtons({});

  return (
    <div style={{ width: isExpanded ? '250px' : '100px' }}>
      <InputsAndOutputs id={nc.id} />
      <NodeHeader
        nodeType={type || 'default'}
        id={nc.id}
        isOpened={nc.isOpened}
        open={nc.open}
        buttons={buttons}
        visible={selected}
      />
      {isOpened && isExpanded && (
        <div className="node-wrapper-body node-background">
          <pre>{JSON.stringify(data || {}, null, 2)}</pre>
          {/*
              <IncomingEdgeHandles />
              <OutgoingEdgeHandles />
              */}
        </div>
      )}
    </div>
  );
};
