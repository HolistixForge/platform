import { useLocalSharedData } from '@holistix-forge/collab/frontend';
import { useDispatcher } from '@holistix-forge/reducers/frontend';
import { ButtonIconProps } from '@holistix-forge/ui-base';

import { TChatSharedData } from '../../chats-shared-model';
import { TChatEvent } from '../../chats-events';
import { TChat } from '../../chats-types';
import { Chatbox, ChatMessage } from './chatbox';

//

export type ChatboxLogicProps = {
  chatId: string;
  userId?: string;
  usersInfo: Map<
    string,
    {
      username: string;
      color?: string;
      picture: string | null;
    }
  >;
  buttons?: ButtonIconProps[];
};

//

export const ChatboxLogic = ({
  chatId,
  userId,
  usersInfo,
  buttons,
}: ChatboxLogicProps) => {
  const chat: TChat | undefined = useLocalSharedData<TChatSharedData>(
    ['chats:chats'],
    (sd) => sd['chats:chats'].get(chatId)
  );
  const dispatcher = useDispatcher<TChatEvent>();

  //

  const messageList: ChatMessage[] =
    chat?.messages.map((m, k) => {
      const u = usersInfo.get(m.user_id);

      let replied = undefined;
      if (m.replyIndex !== undefined && m.replyIndex !== null) {
        const mr = chat.messages[m.replyIndex];
        const ur = usersInfo.get(mr.user_id);

        replied = {
          username: ur?.username || 'unknown',
          picture: null,
          content: chat.messages[m.replyIndex].content,
          color: ur?.color || '#ccc',
          space: 'todo',
          date: new Date(),
          id: `${m.replyIndex}`,
        };
      }

      const cm: ChatMessage = {
        username: u?.username || 'unknown',
        picture: u?.picture || null,
        content: m.content,
        color: u?.color || '#ccc',
        space: 'todo',
        date: new Date(m.date),
        id: `${k}`,
        replied,
      };
      return cm;
    }) || [];

  const handleSendMessage = (msg: string, replyTo?: number) => {
    return dispatcher.dispatch({
      type: 'chats:new-message',
      chatId,
      content: msg,
      replyToIndex: replyTo,
    });
  };

  const handleCurrentUserWriting = (w: boolean) => {
    dispatcher.dispatch({
      type: 'chats:is-writing',
      chatId,
      value: w,
    });
  };

  const writingUsers: { username: string; color?: string }[] = [];

  if (chat) {
    Object.keys(chat.isWriting).forEach((k) => {
      const u = chat.isWriting[k];
      if (u) {
        writingUsers.push(
          usersInfo.get(k) || { username: 'unknown', color: '#ccc' }
        );
      }
    });
  }

  const handleResolve = () => {
    if (chat)
      dispatcher.dispatch({
        type: 'chats:chat-resolve',
        chatId,
        value: !chat.resolved,
      });
  };

  const handleDeleteMessage = (id: string) => {
    if (chat)
      dispatcher.dispatch({
        type: 'chats:delete-message',
        chatId,
        index: parseInt(id),
      });
  };

  const handleAllRead = () => {
    if (chat)
      dispatcher.dispatch({
        type: 'chats:user-has-read',
        chatId,
        index: chat?.messages.length - 1,
      });
  };

  const lastRead = chat && userId ? chat.lastRead[userId] : undefined;

  if (chat)
    return (
      <Chatbox
        status={chat?.resolved ? 'resolved' : 'new'}
        chatId={chatId}
        messageList={messageList}
        onResolve={handleResolve}
        onSendMessage={handleSendMessage}
        onCurrentUserWriting={handleCurrentUserWriting}
        writingUsers={writingUsers}
        onAllRead={handleAllRead}
        lastRead={`${lastRead}`}
        onDeleteMessage={handleDeleteMessage}
        buttons={buttons}
      />
    );

  return 'not found';
};
