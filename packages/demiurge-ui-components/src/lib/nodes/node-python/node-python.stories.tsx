import type { Meta, StoryObj } from '@storybook/react';
import { NodePython, NodePythonProps } from './node-python';
import { playAdd__hover, useTestBoolean } from '../../storybook-utils';
import { StoryMockSpaceContext } from '../../demiurge-space-2/story/storyMockSpaceContext';
import { nodeViewDefaultStatus } from '@monorepo/demiurge-types';

//

const NodeStory = (
  props: Omit<NodePythonProps, 'viewStatus' | 'expand' | 'reduce'> & {
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
    </StoryMockSpaceContext>
  );
};

//

const meta = {
  title: 'Nodes/Python',
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
    id: 'node-1',
    color: 'var(--c-red-4)',
    nodeInfos: true,
    status: 'success',
    expanded: false,
    selected: true,
  },
};

export const Closed_Hover: Story = {
  args: {
    id: 'node-1',
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
    id: 'node-1',
    color: 'var(--c-red-4)',
    nodeInfos: true,
    status: 'success',
    expanded: true,
    selected: true,
  },
};
