import type { Meta, StoryObj } from '@storybook/react';

import { playAdd__hover, useTestBoolean } from '@monorepo/ui-base';
import { nodeViewDefaultStatus } from '@monorepo/space';
import { StoryMockSpaceContextReactflowBgAndCss } from '@monorepo/space/stories';

import { NodeVault, NodeVaultProps } from './node-vault';

//

const StoryWrapper = (
  props: Omit<NodeVaultProps, 'viewStatus' | 'expand' | 'reduce'> & {
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
    <StoryMockSpaceContextReactflowBgAndCss
      inputs={6}
      outputs={7}
      selected={props.selected}
      isOpened={isOpened}
    >
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
    </StoryMockSpaceContextReactflowBgAndCss>
  );
};

const meta = {
  title: 'Modules/Jupyter/Components/Node Vault',
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
    color: 'var(--c-red-4)',
    inputs: 6,
    outputs: 7,
    expanded: false,
    selected: true,
  },
};

export const Closed_Hover: Story = {
  args: {
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
    color: 'var(--c-red-4)',
    inputs: 6,
    outputs: 7,
    expanded: true,
    selected: true,
  },
};
