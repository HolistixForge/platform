import type { Meta, StoryObj } from '@storybook/react';

import {
  CollaborativeContext,
  TCollaborativeChunk,
  TValidSharedData,
  SharedTypes,
  useSharedData,
  useDispatcher,
  Dispatcher,
  SharedMap,
} from '@monorepo/collab-engine';

import { ChatReducer } from './chats-reducer';
import { Chat_loadData, TChatSharedData } from './chats-shared-model';
import { TChatEvent } from './chats-events';
import { useMemo } from 'react';
import { TChat } from './chats-types';
import { ChatBox, ChatMessage } from './components/node-chat/node-chat';

//

const chunks: TCollaborativeChunk[] = [
  {
    sharedData: (st: SharedTypes) => Chat_loadData(st),
    reducers: (sd: TValidSharedData) => [new ChatReducer()],
  },
];

//

const StoryWrapper = () => {
  const dispatcher = useMemo(() => {
    return new Dispatcher({});
  }, []);

  return (
    <CollaborativeContext
      id={'story'}
      collabChunks={chunks}
      config={{
        type: 'none',
      }}
      dispatcher={dispatcher}
      user={{
        username: 'John Doe',
        color: '#ffa500',
      }}
    >
      <ChatsGrid />
    </CollaborativeContext>
  );
};

//

const ChatsGrid = () => {
  const chats: SharedMap<TChat> = useSharedData<TChatSharedData>(
    ['chats'],
    (sd) => sd.chats
  );
  const dispatcher = useDispatcher<TChatEvent>();

  console.log({ chats });

  const addChat = () => {
    dispatcher.dispatch({ type: 'new-chat' });
  };

  return (
    <div>
      <button onClick={addChat}>+</button>
      {Array.from(chats.values()).map((chat) => (
        <ChatLogic chatId={chat.id} />
      ))}
    </div>
  );
};

//

const ChatLogic = ({ chatId }: { chatId: string }) => {
  const chat: TChat | undefined = useSharedData<TChatSharedData>(
    ['chats'],
    (sd) => sd.chats.get(chatId)
  );
  const dispatcher = useDispatcher<TChatEvent>();

  //

  /*
  const messageList: ChatMessage[] =
    chat?.messages.map((m, k) => {
      const u = usersInfo.get(m.user_id) || loading;

      let replied = undefined;
      if (m.replyIndex) {
        const mr = chat.messages[m.replyIndex];
        const ur = usersInfo.get(mr.user_id) || loading;

        replied = {
          username: ur.username,
          picture: null,
          content: chat.messages[m.replyIndex].content,
          color: ur.color,
          space: 'todo',
          date: new Date(),
          id: `${m.replyIndex}`,
        };
      }

      const cm: ChatMessage = {
        username: u.username,
        picture: u.picture,
        content: m.content,
        color: u.color,
        space: 'todo',
        date: new Date(m.date),
        id: `${k}`,
        replied,
      };
      return cm;
    }) || [];
*/

  const handleSendMessage = (msg: string, replyTo?: number) => {
    return dispatcher.dispatch({
      type: 'new-message',
      chatId,
      content: msg,
      replyToIndex: replyTo,
    });
  };

  const handleCurrentUserWriting = (w: boolean) => {
    dispatcher.dispatch({
      type: 'is-writing',
      chatId,
      value: w,
    });
  };

  /*
  const writingUsers: NodeChatProps['writingUsers'] = [];
  if (chat) {
    Object.keys(chat.isWriting).forEach((k) => {
      if (
        currentUserStatus !== 'success' ||
        k !== currentUserData.user.user_id
      ) {
        const u = chat.isWriting[k];
        if (u) {
          writingUsers.push(usersInfo.get(k) || loading);
        }
      }
    });
  }
    */

  const handleResolve = () => {
    if (chat)
      dispatcher.dispatch({
        type: 'chat-resolve',
        chatId,
        value: !chat.resolved,
      });
  };

  const handleDeleteMessage = (id: string) => {
    if (chat)
      dispatcher.dispatch({
        type: 'delete-message',
        chatId,
        index: parseInt(id),
      });
  };

  const handleAllRead = () => {
    if (chat)
      dispatcher.dispatch({
        type: 'user-has-read',
        chatId,
        index: chat?.messages.length - 1,
      });
  };

  /*
  const lastRead =
    chat && currentUserStatus === 'success' && currentUserData.user.user_id
      ? chat.lastRead[currentUserData.user.user_id]
      : undefined;
      */

  if (chat)
    return (
      <ChatBox
        status={chat?.resolved ? 'resolved' : 'new'}
        chatId={chatId}
        messageList={[]}
        onResolve={handleResolve}
        onSendMessage={handleSendMessage}
        onCurrentUserWriting={handleCurrentUserWriting}
        writingUsers={[]}
        onAllRead={handleAllRead}
        lastRead={'2'}
        onDeleteMessage={handleDeleteMessage}
      />
    );

  return 'not found';
};

//

const meta = {
  title: 'Module',
  component: StoryWrapper,
  parameters: {
    layout: 'centered',
  },
  argTypes: {},
} satisfies Meta<typeof StoryWrapper>;

export default meta;

type Story = StoryObj<typeof StoryWrapper>;

export const Default: Story = {
  args: {},
};
