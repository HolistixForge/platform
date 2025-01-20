import type { Meta, StoryObj } from '@storybook/react';
import { NodeDataset, NodeDatasetProps } from './node-dataset';
import { playAdd__hover, useTestBoolean } from '../../storybook-utils';
import { StoryMockSpaceContext } from '../../demiurge-space-2/story/storyMockSpaceContext';
import { nodeViewDefaultStatus } from '@monorepo/demiurge-types';

//

const StoryWrapper = (
  props: Omit<NodeDatasetProps, 'viewStatus' | 'expand' | 'reduce'> & {
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
      <NodeDataset
        {...props}
        isOpened={isOpened}
        open={open}
        close={close}
        expand={expand}
        reduce={reduce}
        viewStatus={{
          ...nodeViewDefaultStatus(),
          mode: isExpanded ? 'EXPANDED' : 'REDUCED',
        }}
      />
    </StoryMockSpaceContext>
  );
};

//

const meta = {
  title: 'Nodes/Dataset',
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

export const Closed: Story = {
  args: {
    id: 'node-1',
    color: 'var(--c-alt-blue-2)',
    expanded: false,
    selected: true,
  },
};

export const Closed_Hover: Story = {
  args: {
    id: 'node-1',
    color: 'var(--c-alt-blue-2)',
    expanded: false,
    selected: true,
  },
  play: playAdd__hover('node-wrapper'),
};

export const Open: Story = {
  args: {
    id: 'node-1',
    color: 'var(--c-alt-blue-2)',
    expanded: true,
    selected: true,
  },
};
