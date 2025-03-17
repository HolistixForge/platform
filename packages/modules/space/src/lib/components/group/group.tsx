import { TGraphNode } from '@monorepo/core';
import { NodeHeader } from '../reactflow-renderer/assets/node-header/node-header';
import { useMakeButton } from '../reactflow-renderer/assets/node-header/node-toolbar';
import { useNodeContext } from '../reactflow-renderer/node-wrappers/node-wrapper';

export const Group = ({ node }: { node: TGraphNode }) => {
  const { id, expand, reduce, isOpened, open, close, viewStatus } =
    useNodeContext();

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
    <div className={`node-group full-height`}>
      <NodeHeader
        nodeType="Group"
        id={id}
        isOpened={isOpened}
        open={open}
        buttons={buttons}
      />
      <div
        className="full-height-wo-header"
        style={{ border: '2px solid red', width: '100%' }}
      >
        <h2>{node.data!.title as string}</h2>
      </div>
    </div>
  );
};
