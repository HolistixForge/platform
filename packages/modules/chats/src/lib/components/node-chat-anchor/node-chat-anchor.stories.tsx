import type { Meta, StoryObj } from '@storybook/react';

import { useTestBoolean } from '@monorepo/ui-base';
import { MockSpace } from '@monorepo/space';

import {
  NodeChatAnchorInternal,
  NodeChatAnchorInternalProps,
} from './node-chat-anchor';

//

const StoryWrapper = (
  props: Pick<
    NodeChatAnchorInternalProps,
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
    <MockSpace selected={props.selected} isOpened={isOpened}>
      <NodeChatAnchorInternal onOpen={open} {...props} isOpened={isOpened} />
    </MockSpace>
  );
};

//

const meta = {
  title: 'Module/Chats/Components/Chat Anchor',
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
    nodeId: 'node-4',
    status: 'default',
    showSideComment: true,
    isOpened: false,
    title: 'Ceci est une question',
    unreadCount: 4,
  },
};

export const Closed_New: Story = {
  args: {
    nodeId: 'node-4',
    status: 'new',
    showSideComment: true,
    isOpened: false,
    title: 'Ceci est une question',
    unreadCount: 4,
  },
};

export const Closed_Resolved: Story = {
  args: {
    nodeId: 'node-4',
    status: 'resolved',
    showSideComment: true,
    isOpened: false,
    title: 'Ceci est une question',
    unreadCount: 4,
  },
};

export const Opened_Default: Story = {
  args: {
    nodeId: 'node-4',
    status: 'default',
    showSideComment: true,
    isOpened: true,
    title: 'Ceci est une question',
    unreadCount: 4,
  },
};

export const Opened_New: Story = {
  args: {
    nodeId: 'node-4',
    status: 'new',
    showSideComment: true,
    isOpened: true,
    title: 'Ceci est une question',
    unreadCount: 4,
  },
};

export const Opened_Resolved: Story = {
  args: {
    nodeId: 'node-4',
    status: 'resolved',
    showSideComment: true,
    isOpened: true,
    title: 'Ceci est une question',
    unreadCount: 4,
  },
};
