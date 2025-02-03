import type { Meta, StoryObj } from '@storybook/react';
import { NodeChatAnchor, NodeChatAnchorProps } from './node-chat-anchor';
import { useTestBoolean } from '../../storybook-utils';
import { StoryMockSpaceContext } from '../../demiurge-space-2';

//

const StoryWrapper = (
  props: Pick<
    NodeChatAnchorProps,
    | 'nodeId'
    | 'status'
    | 'showSideComment'
    | 'isOpened'
    | 'title'
    | 'unreadCount'
  > & { selected: boolean }
) => {
  //
  const { is: isOpened, set: open } = useTestBoolean(props.isOpened);

  return (
    <StoryMockSpaceContext selected={props.selected} isOpened={isOpened}>
      <NodeChatAnchor onOpen={open} {...props} isOpened={isOpened} />
    </StoryMockSpaceContext>
  );
};

//

const meta = {
  title: 'Nodes/Chat Anchor',
  component: StoryWrapper,
  parameters: {
    layout: 'centered',
  },
  argTypes: {
    status: {
      control: {
        type: 'select',
        options: ['default', 'resolved', 'new'],
      },
    },
    showSideComment: {
      control: {
        type: 'boolean',
      },
    },
  },
} satisfies Meta<typeof StoryWrapper>;

export default meta;

type Story = StoryObj<typeof StoryWrapper>;

export const Closed_Default: Story = {
  args: {
    nodeId: 'node-1',
    status: 'default',
    showSideComment: true,
    isOpened: false,
    title: 'Ceci est une question',
    unreadCount: 4,
  },
};

export const Closed_New: Story = {
  args: {
    nodeId: 'node-1',
    status: 'new',
    showSideComment: true,
    isOpened: false,
    title: 'Ceci est une question',
    unreadCount: 4,
  },
};

export const Closed_Resolved: Story = {
  args: {
    nodeId: 'node-1',
    status: 'resolved',
    showSideComment: true,
    isOpened: false,
    title: 'Ceci est une question',
    unreadCount: 4,
  },
};

export const Opened_Default: Story = {
  args: {
    nodeId: 'node-1',
    status: 'default',
    showSideComment: true,
    isOpened: true,
    title: 'Ceci est une question',
    unreadCount: 4,
  },
};

export const Opened_New: Story = {
  args: {
    nodeId: 'node-1',
    status: 'new',
    showSideComment: true,
    isOpened: true,
    title: 'Ceci est une question',
    unreadCount: 4,
  },
};

export const Opened_Resolved: Story = {
  args: {
    nodeId: 'node-1',
    status: 'resolved',
    showSideComment: true,
    isOpened: true,
    title: 'Ceci est une question',
    unreadCount: 4,
  },
};
