import type { Meta, StoryObj } from '@storybook/react';

import {
  playAdd__hover,
  useTestBoolean,
} from '@monorepo/demiurge-ui-components';
import { StoryMockSpaceContext, nodeViewDefaultStatus } from '@monorepo/space';

import {
  NodeNotebookComponent,
  NodeNotebookComponentProps,
} from './node-notebook-component';

//

const NodeStory = (
  props: Omit<
    NodeNotebookComponentProps,
    'viewStatus' | 'expand' | 'reduce' | 'isOpened' | 'open' | 'close'
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
      <NodeNotebookComponent
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
  title: 'Nodes/Notebook/Component',
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

export const ReducedNormal: Story = {
  args: {
    id: 'node-1',
    color: 'var(--c-red-4)',
    status: 'success',
    selected: false,
    expanded: true,
  },
};

export const ReducedHover: Story = {
  parameters: {
    design: {
      type: 'figma',
      url: 'https://www.figma.com/file/t7q8Z4dRrFG5WjZ2WWVisd/Ewan-design?type=design&node-id=687-19548&mode=design&t=pE4zcaJ3ZpYQ6JQl-4',
    },
  },
  args: {
    id: 'node-1',
    color: 'var(--c-red-4)',
    status: 'success',
    selected: false,
    expanded: true,
  },
  play: playAdd__hover('node-reduced'),
};
export const ReducedOpen: Story = {
  parameters: {
    design: {
      type: 'figma',
      url: 'https://www.figma.com/file/t7q8Z4dRrFG5WjZ2WWVisd/Ewan-design?type=design&node-id=687-19691&mode=design&t=pE4zcaJ3ZpYQ6JQl-4',
    },
  },
  args: {
    id: 'node-1',
    color: 'var(--c-red-4)',
    status: 'success',
    notebookOpened: true,
    selected: false,
    expanded: true,
  },
};
