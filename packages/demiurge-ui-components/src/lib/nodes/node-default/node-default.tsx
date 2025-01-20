import { TUseNodeValue } from '@monorepo/demiurge-types';
import { DisablePanSelect, InputsAndOutputs } from '../../demiurge-space-2';
import { NodeHeader } from '../node-common/node-header';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const NodeDefault = ({
  isOpened,
  id,
  open,
  close,
  ...props
}: TUseNodeValue) => {
  return (
    <div className={`common-node default-node`}>
      <InputsAndOutputs id={id} />
      <NodeHeader
        nodeType="default"
        id={id}
        open={open}
        isOpened={isOpened}
        buttons={[]}
      />
      {isOpened && (
        <DisablePanSelect>
          <div className="node-wrapper-body">
            <pre>{JSON.stringify(props, null, 2)}</pre>
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
