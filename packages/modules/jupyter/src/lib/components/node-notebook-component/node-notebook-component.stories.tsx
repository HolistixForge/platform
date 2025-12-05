import type { Meta, StoryObj } from '@storybook/react';

import { playAdd__hover, useTestBoolean } from '@holistix-forge/ui-base';
import { nodeViewDefaultStatus } from '@holistix-forge/whiteboard';
import { StoryMockSpaceContextReactflowBgAndCss } from '@holistix-forge/whiteboard/stories';

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
    <StoryMockSpaceContextReactflowBgAndCss
      inputs={3}
      outputs={4}
      selected={props.selected}
      isOpened={isOpened}
    >
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
    </StoryMockSpaceContextReactflowBgAndCss>
  );
};

//

const meta = {
  title: 'Modules/Jupyter/Components/Node Notebook Component',
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
    color: 'var(--c-red-4)',
    status: 'success',
    notebookOpened: true,
    selected: false,
    expanded: true,
  },
};
