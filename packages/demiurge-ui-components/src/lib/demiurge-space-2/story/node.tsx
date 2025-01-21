import { InputsAndOutputs } from '../reactflow-renderer/assets/inputsOutputs/inputsOutputs';
import { useNodeContext } from '../reactflow-renderer/node-wrappers/node-wrapper';

export const CustomStoryNode = () => {
  const data = useNodeContext();
  return (
    <>
      <InputsAndOutputs id={data.id} />
      <span>{data.id}</span>
    </>
  );
};
