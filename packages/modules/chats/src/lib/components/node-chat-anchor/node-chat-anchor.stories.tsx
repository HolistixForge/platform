import type { Meta, StoryObj } from '@storybook/react';

import { useTestBoolean } from '@monorepo/ui-base';
import { StoryMockSpaceContextReactflowBgAndCss } from '@monorepo/space/stories';
import { ModuleProvider } from '@monorepo/module/frontend';

import {
  NodeChatAnchorInternal,
  NodeChatAnchorInternalProps,
} from './node-chat-anchor';

//

const fakeFrontendModules = {
  reducers: {
    dispatcher: {
      dispatch: () => {
        /**/
      },
    },
  },
};

const StoryWrapper = (
  props: Pick<
    NodeChatAnchorInternalProps,
    'status' | 'showSideComment' | 'isOpened' | 'title' | 'unreadCount'
  > & { selected: boolean }
) => {
  //
  const { is: isOpened, set: open } = useTestBoolean(props.isOpened);

  const nodeId = 'whatever';

  return (
    <ModuleProvider exports={fakeFrontendModules}>
      <StoryMockSpaceContextReactflowBgAndCss
        nodeId={nodeId}
        selected={props.selected}
        isOpened={isOpened}
      >
        <NodeChatAnchorInternal
          nodeId={nodeId}
          onOpen={open}
          {...props}
          isOpened={isOpened}
          onClose={() => {
            /**/
          }}
        />
      </StoryMockSpaceContextReactflowBgAndCss>
    </ModuleProvider>
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
    status: 'default',
    showSideComment: true,
    isOpened: false,
    title: 'Ceci est une question',
    unreadCount: 4,
  },
};

export const Closed_New: Story = {
  args: {
    status: 'new',
    showSideComment: true,
    isOpened: false,
    title: 'Ceci est une question',
    unreadCount: 4,
  },
};

export const Closed_Resolved: Story = {
  args: {
    status: 'resolved',
    showSideComment: true,
    isOpened: false,
    title: 'Ceci est une question',
    unreadCount: 4,
  },
};

export const Opened_Default: Story = {
  args: {
    status: 'default',
    showSideComment: true,
    isOpened: true,
    title: 'Ceci est une question',
    unreadCount: 4,
  },
};

export const Opened_New: Story = {
  args: {
    status: 'new',
    showSideComment: true,
    isOpened: true,
    title: 'Ceci est une question',
    unreadCount: 4,
  },
};

export const Opened_Resolved: Story = {
  args: {
    status: 'resolved',
    showSideComment: true,
    isOpened: true,
    title: 'Ceci est une question',
    unreadCount: 4,
  },
};
