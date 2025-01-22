import { NodeHeader } from '../../nodes/node-common/node-header';
import { useMakeButton } from '../../nodes/node-common/node-toolbar';
import { InputsAndOutputs } from '../reactflow-renderer/assets/inputsOutputs/inputsOutputs';
import { useNodeContext } from '../reactflow-renderer/node-wrappers/node-wrapper';

export const CustomStoryNode = () => {
  const data = useNodeContext();

  const { close, expand, reduce, isOpened, viewStatus } = data;

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
    <div style={{ width: '200px' }}>
      <InputsAndOutputs id={data.id} />
      <NodeHeader
        nodeType={'test'}
        id={data.id}
        isOpened={data.isOpened}
        open={data.open}
        buttons={buttons}
      />
    </div>
  );
};
