import type { Meta, StoryObj } from '@storybook/react';
import { InputsOutputs, InputsOutputsProps } from './inputsOutputs';
import { MockSpace } from '../../../../stories/mockSpace';

//

const InputStory = (props: InputsOutputsProps) => {
  return (
    <MockSpace>
      <div style={{ position: 'relative' }}>
        <InputsOutputs {...props} />
      </div>
    </MockSpace>
  );
};

//

const meta = {
  title: 'Modules/Space/Components/Inputs Outputs',
  component: InputStory,
  parameters: {
    layout: 'centered',
  },
  argTypes: {},
} satisfies Meta<typeof InputsOutputs>;

//

export default meta;

//

type Story = StoryObj<typeof InputsOutputs>;

//

export const Simple_Input: Story = {
  args: {
    nodeId: 'node-4',
    connectorName: 'inputs',
  },
};

export const Simple_Ouput: Story = {
  args: {
    nodeId: 'node-4',
    connectorName: 'outputs',
  },
};

export const Piano_Input: Story = {
  args: {
    nodeId: 'node-1',
    connectorName: 'inputs',
  },
};

export const Piano_Ouput: Story = {
  args: {
    nodeId: 'node-1',
    connectorName: 'outputs',
  },
};
