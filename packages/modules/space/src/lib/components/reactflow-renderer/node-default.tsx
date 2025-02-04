import { TUseNodeValue } from '../apis/types/node';
import { InputsAndOutputs } from './assets/inputsOutputs/inputsOutputs';
import { NodeHeader } from './assets/node-header/node-header';
import { DisablePanSelect } from './node-wrappers/disable-pan-select';

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
