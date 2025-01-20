import type { Meta, StoryObj } from '@storybook/react';
import { InputsOutputs, InputsOutputsProps, THandle } from './inputsOutputs';
import { StoryMockSpaceContext } from '../../../story/storyMockSpaceContext';

/**
 *
 */

const mockSlots = (connectorName: string): THandle[] => {
  if (connectorName === 'inputs')
    return Array(10)
      .fill(1)
      .map((v, k) => ({ id: `handle_target_${k}`, name: `slot ${k}` }));
  else if (connectorName === 'outputs')
    return Array(10)
      .fill(1)
      .map((v, k) => ({ id: `handle_source_${k}`, name: `slot ${k}` }));
  else return [];
};

//

const InputStory = (props: InputsOutputsProps) => {
  return (
    <StoryMockSpaceContext>
      <div style={{ position: 'relative' }}>
        <InputsOutputs {...props} />
      </div>
    </StoryMockSpaceContext>
  );
};

//

const meta = {
  title: 'Space/ReactFlow/InputsOutputs',
  component: InputStory,
  parameters: {
    layout: 'centered',
  },
  argTypes: {
    type: {
      options: ['inputs', 'outputs'],
      mapping: ['inputs', 'outputs'],
      control: {
        type: 'select',
        labels: ['inputs', 'outputs'],
      },
    },
  },
} satisfies Meta<typeof InputsOutputs>;

//

export default meta;

//

type Story = StoryObj<typeof InputsOutputs>;

//

export const Simple_Input: Story = {
  args: {
    nodeId: 'node-1',
    type: 'target',
  },
};

export const Simple_Ouput: Story = {
  args: {
    nodeId: 'node-1',
    type: 'source',
  },
};

export const Piano_Input_Open: Story = {
  args: {
    nodeId: 'node-1',
    type: 'target',
    slots: mockSlots('inputs'),
    forceOpened: true,
  },
};

export const Piano_Input_Closed: Story = {
  args: {
    nodeId: 'node-1',
    type: 'target',
    slots: mockSlots('inputs'),
  },
};

export const Piano_Ouput_Open: Story = {
  args: {
    nodeId: 'node-1',
    type: 'source',
    slots: mockSlots('outputs'),
    forceOpened: true,
  },
};

export const Piano_Ouput_Closed: Story = {
  args: {
    nodeId: 'node-1',
    type: 'source',
    slots: mockSlots('outputs'),
  },
};
