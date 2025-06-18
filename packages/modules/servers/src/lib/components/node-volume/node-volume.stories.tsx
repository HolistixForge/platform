import type { Meta, StoryObj } from '@storybook/react';

import { nodeViewDefaultStatus } from '@monorepo/space';
import { StoryMock_CollaborativeContext_SpaceContext_ReactflowBgAndCss } from '@monorepo/space/stories';
import { sleep } from '@monorepo/simple-types';
import { useTestBoolean } from '@monorepo/ui-base';

import { NodeVolumeInternal, NodeVolumeInternalProps } from './node-volume';

//

const StoryWrapper = (
  props: Pick<
    NodeVolumeInternalProps,
    'volume_name' | 'volume_storage' | 'filterOut'
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
      selected={props.selected}
      isOpened={isOpened}
      inputs={0}
      outputs={0}
    >
      <NodeVolumeInternal
        id="efa52136"
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
    </StoryMock_CollaborativeContext_SpaceContext_ReactflowBgAndCss>
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
    volume_name: 'My Volume 1',
    volume_storage: 42,
    selected: true,
    expanded: true,
  },
};
