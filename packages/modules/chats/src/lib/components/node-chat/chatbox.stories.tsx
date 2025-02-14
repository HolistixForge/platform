import type { Meta, StoryObj } from '@storybook/react';

import { Chatbox, ChatboxProps } from './chatbox';
import { testUsers, useTestChatBox } from './test';

//
//

const StoryWrapper = (
  props: Pick<
    ChatboxProps,
    'chatId' | 'status' | 'general' | 'writingUsers' | 'lastRead'
  > & {
    width: number;
    height: number;
  }
) => {
  const {
    status,
    setStatus,
    messageList,
    handleSendMessage,
    handleDeleteMessage,
    isWriting,
    setWriting,
  } = useTestChatBox(props.status);
  return (
    <div>
      <div style={{ width: `${props.width}px`, height: `${props.height}px` }}>
        <Chatbox
          onResolve={(v) => setStatus(v ? 'resolved' : 'default')}
          messageList={messageList}
          onSendMessage={handleSendMessage}
          onCurrentUserWriting={(w: boolean) => setWriting(w)}
          onAllRead={() => alert('Congrats, you read it all')}
          onDeleteMessage={handleDeleteMessage}
          {...props}
          status={status}
        />
      </div>
      {isWriting && (
        <p style={{ color: 'green' }}>Current user is writing ...</p>
      )}
    </div>
  );
};

//

const meta = {
  title: 'Module/Chats/Components/Chat Box',
  component: StoryWrapper,
  parameters: {
    layout: 'centered',
  },
  argTypes: {
    width: {
      control: {
        type: 'number',
        min: 300,
        max: 1000,
        step: 10,
      },
    },
  },
} satisfies Meta<typeof StoryWrapper>;

export default meta;

type Story = StoryObj<typeof StoryWrapper>;

export const Default: Story = {
  args: {
    chatId: '1012482',
    status: 'default',
    width: 300,
    height: 368,
  },
};

export const Resolved: Story = {
  args: {
    chatId: '1012482',
    status: 'resolved',
    width: 300,
    height: 368,
  },
};

export const New: Story = {
  parameters: {
    design: {
      type: 'figma',
      url: '  https://www.figma.com/file/t7q8Z4dRrFG5WjZ2WWVisd/Ewan-design?type=design&node-id=116-4412&mode=design&t=uKSYv7FyaxBNg4vu-4',
    },
  },
  args: {
    chatId: '1012482',
    status: 'new',
    width: 300,
    height: 368,
  },
};

export const SomeoneWriting: Story = {
  args: {
    chatId: '1012482',
    status: 'new',
    width: 300,
    height: 368,
    lastRead: '567894',
    writingUsers: [testUsers[2], testUsers[1]],
  },
};

export const General: Story = {
  parameters: {
    design: {
      type: 'figma',
      url: 'https://www.figma.com/file/t7q8Z4dRrFG5WjZ2WWVisd/Ewan-design?type=design&node-id=116-4475&mode=design&t=uKSYv7FyaxBNg4vu-4',
    },
  },
  args: {
    chatId: '1012482',
    status: 'default',
    general: true,
    width: 300,
    height: 368,
  },
};

export const Wide: Story = {
  parameters: {
    design: {
      type: 'figma',
      url: 'https://www.figma.com/file/t7q8Z4dRrFG5WjZ2WWVisd/Ewan-design?type=design&node-id=116-4475&mode=design&t=uKSYv7FyaxBNg4vu-4',
    },
  },
  args: {
    chatId: '1012482',
    status: 'default',
    general: true,
    width: 600,
    height: 700,
  },
};
