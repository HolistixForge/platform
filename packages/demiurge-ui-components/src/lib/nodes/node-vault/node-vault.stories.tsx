import type { Meta, StoryObj } from '@storybook/react';
import { NodeVault, NodeVaultProps } from './node-vault';
import { playAdd__hover, useTestBoolean } from '../../storybook-utils';
import { StoryMockSpaceContext } from '../../demiurge-space-2/story/storyMockSpaceContext';
import { nodeViewDefaultStatus } from '@monorepo/demiurge-types';
//

const StoryWrapper = (
  props: Omit<NodeVaultProps, 'viewStatus' | 'expand' | 'reduce'> & {
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
      <NodeVault
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

const meta = {
  title: 'Nodes/Vault',
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
    outputs: {
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
    color: 'var(--c-red-4)',
    inputs: 6,
    outputs: 7,
    expanded: false,
    selected: true,
  },
};

export const Closed_Hover: Story = {
  args: {
    id: 'node-1',
    color: 'var(--c-red-4)',
    inputs: 6,
    outputs: 7,
    expanded: false,
    selected: true,
  },
  play: playAdd__hover('node-wrapper'),
};

export const Opened: Story = {
  args: {
    id: 'node-1',
    color: 'var(--c-red-4)',
    inputs: 6,
    outputs: 7,
    expanded: true,
    selected: true,
  },
};
