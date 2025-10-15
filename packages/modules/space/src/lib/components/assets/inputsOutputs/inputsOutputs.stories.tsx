import type { Meta, StoryObj } from '@storybook/react';
import { InputsOutputs } from './inputsOutputs';
import { StoryMockSpaceContextReactflowBgAndCss } from '../../../stories/story-context-mocks';

//

const StoryWrapper = (props: {
  connectorName: 'inputs' | 'outputs';
  pinCount?: number;
}) => {
  const nodeId = 'whatever';

  return (
    <StoryMockSpaceContextReactflowBgAndCss
      nodeId={nodeId}
      inputs={props.pinCount}
      outputs={props.pinCount}
    >
      <p style={{ height: '100px' }}>
        This story does show the correct pin count sometimes. it is due to an
        identified missing refresh/update of data. look for TODO_CONNECTOR in
        the code
      </p>
      <div style={{ position: 'relative' }}>
        <InputsOutputs nodeId={nodeId} {...props} />
      </div>
    </StoryMockSpaceContextReactflowBgAndCss>
  );
};

//

const meta = {
  title: 'Modules/Space/Components/Inputs Outputs',
  component: StoryWrapper,
  parameters: {
    layout: 'centered',
  },
  argTypes: {},
} satisfies Meta<typeof StoryWrapper>;

//

export default meta;

//

type Story = StoryObj<typeof StoryWrapper>;

//

export const Simple_Input: Story = {
  args: {
    connectorName: 'inputs',
    pinCount: 0,
  },
};

export const Simple_Ouput: Story = {
  args: {
    connectorName: 'outputs',
    pinCount: 0,
  },
};

export const Piano_Input: Story = {
  args: {
    connectorName: 'inputs',
    pinCount: 4,
  },
};

export const Piano_Ouput: Story = {
  args: {
    connectorName: 'outputs',
    pinCount: 4,
  },
};
