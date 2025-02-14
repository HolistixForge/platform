import type { Meta, StoryObj } from '@storybook/react';

import { StoryMockSpaceContext, nodeViewDefaultStatus } from '@monorepo/space';
import { sleep } from '@monorepo/simple-types';
import { useTestBoolean } from '@monorepo/ui-base';

import { NodeVolume, NodeVolumeProps } from './node-volume';

//

const StoryWrapper = (
  props: Pick<NodeVolumeProps, 'id' | 'volume_name' | 'volume_storage'> & {
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
      <NodeVolume
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
    </StoryMockSpaceContext>
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
    id: 'node-1',
    volume_name: 'My Volume 1',
    volume_storage: 42,
    selected: true,
    expanded: true,
  },
};
