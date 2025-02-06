import type { Meta, StoryObj } from '@storybook/react';

import { playAdd__hover, useTestBoolean } from '@monorepo/ui-base';
import { StoryMockSpaceContext, nodeViewDefaultStatus } from '@monorepo/space';

import { NodeScreening, NodeScreeningProps } from './node-screening';

//

const StoryWrapper = (
  props: Omit<NodeScreeningProps, 'viewStatus' | 'expand' | 'reduce'> & {
    expanded: boolean;
    selected: boolean;
  }
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
      <NodeScreening
        {...props}
        expand={expand}
        reduce={reduce}
        viewStatus={{
          ...nodeViewDefaultStatus(),
          mode: isExpanded ? 'EXPANDED' : 'REDUCED',
        }}
        isOpened={isOpened}
        open={open}
        close={close}
      />
    </StoryMockSpaceContext>
  );
};

//

const meta = {
  title: 'Nodes/Screening',
  component: StoryWrapper,
  parameters: {
    layout: 'centered',
  },
  argTypes: {
    color: {
      control: {
        type: 'color',
      },
    },
    inputs: {
      control: {
        type: 'number',
      },
    },
  },
} satisfies Meta<typeof StoryWrapper>;

export default meta;

type Story = StoryObj<typeof StoryWrapper>;

export const Closed: Story = {
  args: {
    id: 'node-1',
    color: 'var(--c-alt-blue-2)',
    inputs: 4,
    expanded: false,
    selected: true,
  },
};

export const Closed_Hover: Story = {
  args: {
    id: 'node-1',
    color: 'var(--c-alt-blue-2)',
    inputs: 4,
    expanded: false,
    selected: true,
  },
  play: playAdd__hover('node-wrapper'),
};

export const Opened: Story = {
  args: {
    id: 'node-1',
    color: 'var(--c-alt-blue-2)',
    inputs: 4,
    expanded: true,
    selected: true,
  },
};
