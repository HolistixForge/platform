import type { Meta, StoryObj } from '@storybook/react';

import { useTestBoolean } from '@monorepo/ui-base';
import { StoryMockSpaceContext, nodeViewDefaultStatus } from '@monorepo/space';

import {
  NodeTextEditorInternal,
  NodeTextEditorInternalProps,
} from './text-editor';

//

const NodeStory = (
  props: Omit<
    NodeTextEditorInternalProps,
    'viewStatus' | 'expand' | 'reduce'
  > & {
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
      <NodeTextEditorInternal
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
  title: 'Nodes/Quill',
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
  },
} satisfies Meta<typeof NodeStory>;

export default meta;

type Story = StoryObj<typeof NodeStory>;

export const Default: Story = {
  args: {
    id: 'node-1',
    selected: true,
  },
};
