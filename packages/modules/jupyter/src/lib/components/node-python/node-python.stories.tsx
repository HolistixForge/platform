import type { Meta, StoryObj } from '@storybook/react';

import { playAdd__hover, useTestBoolean } from '@monorepo/ui-base';
import { nodeViewDefaultStatus } from '@monorepo/space';
import { StoryMockSpaceContextReactflowBgAndCss } from '@monorepo/space/stories';

import { NodePython, NodePythonProps } from './node-python';

//

const NodeStory = (
  props: Omit<NodePythonProps, 'viewStatus' | 'expand' | 'reduce'> & {
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
      inputs={3}
      outputs={4}
      selected={props.selected}
      isOpened={isOpened}
    >
      <NodePython
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

//

const meta = {
  title: 'Modules/Jupyter/Components/Node Python',
  component: NodeStory,
  parameters: {
    layout: 'centered',
  },
  argTypes: {
    selected: {
      control: {
        type: 'boolean',
      },
    },
    color: {
      control: {
        type: 'color',
      },
    },
    nodeInfos: {
      control: {
        type: 'boolean',
      },
    },
    status: {
      options: ['success', 'error', 'loading'],
      mapping: ['success', 'error', 'loading'],
      control: {
        type: 'select',
        labels: ['success', 'error', 'loading'],
      },
    },
  },
} satisfies Meta<typeof NodeStory>;

export default meta;

type Story = StoryObj<typeof NodeStory>;

export const Closed: Story = {
  args: {
    color: 'var(--c-red-4)',
    nodeInfos: true,
    status: 'success',
    expanded: false,
    selected: true,
  },
};

export const Closed_Hover: Story = {
  args: {
    color: 'var(--c-red-4)',
    nodeInfos: true,
    status: 'success',
    expanded: false,
    selected: true,
  },
  play: playAdd__hover('node-wrapper'),
};

export const Opened: Story = {
  parameters: {
    design: {
      type: 'figma',
      url: 'https://www.figma.com/file/t7q8Z4dRrFG5WjZ2WWVisd/Ewan-design?type=design&node-id=10-572&mode=design&t=uKSYv7FyaxBNg4vu-4',
    },
  },
  args: {
    color: 'var(--c-red-4)',
    nodeInfos: true,
    status: 'success',
    expanded: true,
    selected: true,
  },
};
