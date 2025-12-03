import type { Meta, StoryObj } from '@storybook/react';
import { InputsOutputs } from './inputsOutputs';
import { StoryMockSpaceContextReactflowBgAndCss } from '../../../stories/story-context-mocks';
import { ModuleProvider } from '@holistix/module/frontend';

//

const fakeFrontendModules = {
  reducers: {
    dispatcher: {
      dispatch: () => {
        /**/
      },
    },
  },
};

const StoryWrapper = (props: {
  connectorName: 'inputs' | 'outputs';
  pinCount?: number;
}) => {
  const nodeId = 'whatever';

  return (
    <ModuleProvider exports={fakeFrontendModules}>
      <StoryMockSpaceContextReactflowBgAndCss
        nodeId={nodeId}
        inputs={props.pinCount}
        outputs={props.pinCount}
      >
        <div style={{ position: 'relative' }}>
          <InputsOutputs nodeId={nodeId} {...props} />
        </div>
      </StoryMockSpaceContextReactflowBgAndCss>
    </ModuleProvider>
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
