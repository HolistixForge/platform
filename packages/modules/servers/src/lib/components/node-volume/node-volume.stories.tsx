import type { Meta, StoryObj } from '@storybook/react';

import { nodeViewDefaultStatus } from '@monorepo/space';
import { StoryNode, STORY_NODE_ID } from '@monorepo/space/stories';
import { sleep } from '@monorepo/simple-types';
import { useTestBoolean } from '@monorepo/ui-base';

import { NodeVolumeInternal, NodeVolumeInternalProps } from './node-volume';

//

const StoryWrapper = (
  props: Pick<
    NodeVolumeInternalProps,
    'id' | 'volume_name' | 'volume_storage' | 'filterOut'
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
    <StoryNode selected={props.selected} isOpened={isOpened}>
      <NodeVolumeInternal
        expand={expand}
        reduce={reduce}
        viewStatus={{
          ...nodeViewDefaultStatus(),
          mode: isExpanded ? 'EXPANDED' : 'REDUCED',
        }}
        onDelete={() => sleep()}
        isOpened={isOpened}
        open={open}
        close={close}
        {...props}
      />
    </StoryNode>
  );
};

//

const meta = {
  title: 'Modules/Servers/Components/Node Volume',
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

export const Primary: Story = {
  args: {
    id: STORY_NODE_ID,
    volume_name: 'My Volume 1',
    volume_storage: 42,
    selected: true,
    expanded: true,
  },
};
