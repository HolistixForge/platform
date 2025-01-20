import type { Meta, StoryObj } from '@storybook/react';
import { sleep, useTestBoolean } from '../../storybook-utils';
import { NodeKernel, NodeKernelProps } from './node-kernel';
import { StoryMockSpaceContext } from '../../demiurge-space-2/story/storyMockSpaceContext';
import { nodeViewDefaultStatus } from '@monorepo/demiurge-types';

//

const StoryWrapper = (
  props: Pick<
    NodeKernelProps,
    'id' | 'state' | 'kernelName' | 'kernelType' | 'StartProgress'
  > & {
    expanded: boolean;
    selected: boolean;
  },
) => {
  //
  const { is: isOpened, set: open, unset: close } = useTestBoolean(true);
  const {
    is: isExpanded,
    set: expand,
    unset: reduce,
  } = useTestBoolean(props.expanded);

  return (
    <StoryMockSpaceContext selected={props.selected} isOpened={isOpened}>
      <NodeKernel
        expand={expand}
        reduce={reduce}
        viewStatus={{
          ...nodeViewDefaultStatus(),
          mode: isExpanded ? 'EXPANDED' : 'REDUCED',
        }}
        startState={'starting'}
        onDelete={() => sleep()}
        isOpened={isOpened}
        open={open}
        close={close}
        {...props}
      />
    </StoryMockSpaceContext>
  );
};

//

const meta = {
  title: 'Nodes/Kernel',
  component: StoryWrapper,
  parameters: {
    layout: 'centered',
    color: {
      control: {
        type: 'color',
      },
    },
  },
  argTypes: {},
} satisfies Meta<typeof StoryWrapper>;

export default meta;

type Story = StoryObj<typeof StoryWrapper>;

export const Primary: Story = {
  args: {
    id: 'node-1',
    state: 'kernel-started',
    kernelName: 'K2000',
    kernelType: 'python 3',
    selected: true,
    StartProgress: 66,
    expanded: true,
  },
};
