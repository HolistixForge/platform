import type { Meta, StoryObj } from '@storybook/react';

import { useTestBoolean } from '@monorepo/ui-base';
import { sleep } from '@monorepo/simple-types';
import { StoryMockSpaceContext, nodeViewDefaultStatus } from '@monorepo/space';

import { NodeTerminal, NodeTerminalProps } from './node-terminal';

//

const FakeTerminal = (p: {
  project_server_id: number;
  server_name: string;
}) => {
  return (
    <div
      style={{
        height: '400px',
        width: '550px',
        background: 'var(--c-black-5)',
      }}
    ></div>
  );
};

//
//

const StoryWrapper = (
  props: Pick<NodeTerminalProps, 'id' | 'server_name'> & {
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
      <NodeTerminal
        expand={expand}
        reduce={reduce}
        viewStatus={{
          ...nodeViewDefaultStatus(),
          mode: isExpanded ? 'EXPANDED' : 'REDUCED',
        }}
        project_server_id={42}
        Terminal={FakeTerminal}
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
//

const meta = {
  title: 'Nodes/Terminal',
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
    server_name: 'my_super_server',
    selected: true,
    expanded: true,
  },
};
