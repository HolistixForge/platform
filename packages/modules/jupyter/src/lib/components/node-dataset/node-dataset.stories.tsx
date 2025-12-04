import type { Meta, StoryObj } from '@storybook/react';

import { playAdd__hover, useTestBoolean } from '@holistix-forge/ui-base';
import { nodeViewDefaultStatus } from '@holistix-forge/space';
import { StoryMockSpaceContextReactflowBgAndCss } from '@holistix-forge/space/stories';

import { NodeDataset, NodeDatasetProps } from './node-dataset';

//

const StoryWrapper = (
  props: Omit<NodeDatasetProps, 'viewStatus' | 'expand' | 'reduce'> & {
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
      outputs={5}
      selected={props.selected}
      isOpened={isOpened}
    >
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
    </StoryMockSpaceContextReactflowBgAndCss>
  );
};

//

const meta = {
  title: 'Modules/Jupyter/Components/Node Dataset',
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
    color: 'var(--c-alt-blue-2)',
    expanded: false,
    selected: true,
  },
};

export const Closed_Hover: Story = {
  args: {
    color: 'var(--c-alt-blue-2)',
    expanded: false,
    selected: true,
  },
  play: playAdd__hover('node-wrapper'),
};

export const Open: Story = {
  args: {
    color: 'var(--c-alt-blue-2)',
    expanded: true,
    selected: true,
  },
};
