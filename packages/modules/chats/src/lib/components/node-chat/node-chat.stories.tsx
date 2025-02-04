import type { Meta, StoryObj } from '@storybook/react';

import { NodeChatProps, NodeChat } from './node-chat';
import { useTestChatBox } from './test';
import { StoryMockSpaceContext } from '@monorepo/space';

//

const StoryWrapper = (
  props: Pick<
    NodeChatProps,
    'id' | 'chatId' | 'status' | 'general' | 'viewStatus'
  > & {
    selected: boolean;
  }
) => {
  const {
    status,
    setStatus,
    messageList,
    handleSendMessage,
    handleDeleteMessage,
  } = useTestChatBox(props.status);

  return (
    <StoryMockSpaceContext selected={props.selected}>
      <NodeChat
        close={function (): void {
          return;
        }}
        {...props}
        onResolve={(v) => setStatus(v ? 'resolved' : 'default')}
        messageList={messageList}
        onSendMessage={handleSendMessage}
        onDeleteMessage={handleDeleteMessage}
        status={status}
      />
    </StoryMockSpaceContext>
  );
};

//

const meta = {
  title: 'Nodes/Chat/NodeChat',
  component: StoryWrapper,
  parameters: {
    layout: 'centered',
  },
  argTypes: {},
} satisfies Meta<typeof StoryWrapper>;

export default meta;

type Story = StoryObj<typeof StoryWrapper>;

export const General: Story = {
  parameters: {
    design: {
      type: 'figma',
      url: 'https://www.figma.com/file/t7q8Z4dRrFG5WjZ2WWVisd/Ewan-design?type=design&node-id=116-4475&mode=design&t=uKSYv7FyaxBNg4vu-4',
    },
  },
  args: {
    id: 'node-1',
    chatId: '1012482',
    status: 'default',
    general: true,
    selected: true,
  },
};
