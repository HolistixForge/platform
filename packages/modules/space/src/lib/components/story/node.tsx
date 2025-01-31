import { useMakeButton, NodeHeader } from '../../components';
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
    <div style={{ width: isExpanded ? '250px' : '100px' }}>
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
