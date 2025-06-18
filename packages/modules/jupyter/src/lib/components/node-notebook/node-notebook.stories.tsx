import type { Meta, StoryObj } from '@storybook/react';

import { playAdd__hover, useTestBoolean } from '@monorepo/ui-base';
import { nodeViewDefaultStatus } from '@monorepo/space';
import { StoryMock_CollaborativeContext_SpaceContext_ReactflowBgAndCss } from '@monorepo/space/stories';

import { NodeNotebookProps } from './node-notebook';
import { NodeNotebook } from './node-notebook';

//

const NodeStory = (
  props: Omit<
    NodeNotebookProps,
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
    <StoryMock_CollaborativeContext_SpaceContext_ReactflowBgAndCss
      inputs={3}
      outputs={4}
      selected={props.selected}
      isOpened={isOpened}
    >
      <NodeNotebook
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
    </StoryMock_CollaborativeContext_SpaceContext_ReactflowBgAndCss>
  );
};

const meta = {
  title: 'Modules/Jupyter/Components/Node Notebook',
  component: NodeStory,
  parameters: {
    layout: 'centered',
  },
  argTypes: {
    arrow: {
      control: {
        type: 'select',
        options: ['top', 'left', 'right', 'bottom'],
      },
    },
    status: {
      control: {
        type: 'select',
        options: ['success', 'error', 'loading'],
      },
    },
    titleFixed: {
      control: {
        type: 'boolean',
      },
    },
    expanded: {
      control: {
        type: 'boolean',
      },
    },
  },
} satisfies Meta<typeof NodeStory>;

export default meta;

type Story = StoryObj<typeof NodeStory>;

export const SpreadNormal: Story = {
  parameters: {
    design: {
      type: 'figma',
      url: 'https://www.figma.com/file/t7q8Z4dRrFG5WjZ2WWVisd/Ewan-design?type=design&node-id=687-19977&mode=design&t=pE4zcaJ3ZpYQ6JQl-4',
    },
  },
  args: {
    arrow: 'bottom',
    status: 'success',
    titleFixed: false,
    nodeInfos: true,
    selected: false,
    expanded: true,
  },
};

export const SpreadTitle: Story = {
  parameters: {
    design: {
      type: 'figma',
      url: 'https://www.figma.com/file/t7q8Z4dRrFG5WjZ2WWVisd/Ewan-design?type=design&node-id=687-21301&mode=design&t=pE4zcaJ3ZpYQ6JQl-4',
    },
  },
  args: {
    titleFixed: true,
    nodeInfos: true,
    selected: false,
    arrow: 'bottom',
    status: 'success',
    expanded: true,
  },
};

export const SpreadHover: Story = {
  parameters: {
    design: {
      type: 'figma',
      url: 'https://www.figma.com/file/t7q8Z4dRrFG5WjZ2WWVisd/Ewan-design?type=design&node-id=694-21387&mode=design&t=pE4zcaJ3ZpYQ6JQl-4',
    },
  },
  args: {
    nodeInfos: true,
    selected: false,
    expanded: true,
  },
  play: playAdd__hover('spread'),
};
