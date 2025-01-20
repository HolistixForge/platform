import { ChatMessage, ChatBoxProps } from './node-chat';
import { useState } from 'react';
import { SimpleMessage } from '../../discussionItem/discussionItem';
import { sleep } from '../../storybook-utils';
import { ReplyMessage } from '../../replyItem/replyItem';

//

export const useTestChatBox = (_status: ChatBoxProps['status']) => {
  const [status, setStatus] = useState(_status);
  const [messageList, setMessageList] = useState<ChatMessage[]>(testMessages);
  const [isWriting, setWriting] = useState(false);

  const handleSendMessage = async (msg: string, replyTo?: number) => {
    await sleep();
    const n: SimpleMessage = {
      username: 'local:John Doe',
      content: msg,
      color: 'var(--c-orange-2)',
      space: '48946',
      id: `${messageList.length}`,
      date: new Date(),
      picture: null,
    };
    if (replyTo) {
      const r: ReplyMessage = { ...n, replied: messageList[replyTo] };
      const na: SimpleMessage[] = [...messageList, r];
      setMessageList(na);
    } else {
      const na: SimpleMessage[] = [...messageList, n];
      setMessageList(na);
    }
  };

  const handleDeleteMessage = (id: string) => {
    const m = messageList.find((m) => m.id === id);
    if (m) m.content = '[deleted]';
    setMessageList([...messageList]);
  };

  return {
    status,
    setStatus,
    messageList,
    handleSendMessage,
    handleDeleteMessage,
    isWriting,
    setWriting,
  };
};

/**
 *
 *
 *
 *
 */

export const testUsers = [
  {
    username: 'github:Alice Dj',
    color: 'var(--c-pink-4)',
    picture: null,
  },
  {
    username: 'local:Mickey Willis',
    color: 'var(--c-green-1)',
    picture: null,
  },
  {
    username: 'gitlab:Paul Jean-Claude Junior de la Vega',
    color: 'var(--c-blue-3)',
    picture: null,
  },
];

const testMessages = [
  {
    ...testUsers[0],
    content: 'Brian, do you think I’m a bad mother?',
    space: '48946',
    id: '567890',
    date: new Date(),
  },
  {
    ...testUsers[1],
    content: 'Have you seen my lawnmower ?',
    space: '48946',
    id: '567891',
    date: new Date(),
  },
  {
    ...testUsers[2],
    content: 'Well, my name is Paul',
    space: '48946',
    id: '567892',
    date: new Date(),
    replied: {
      ...testUsers[0],
      content: 'Brian, do you think I’m a bad mother?',
      space: '48946',
      id: '567893',
      date: new Date(),
    },
  },
  {
    ...testUsers[2],
    content: 'I was born in Paris.',
    space: '48946',
    id: '567894',
    date: new Date(),
  },
  {
    ...testUsers[1],
    content: 'Please..., have you seen my lawnmower ?',
    space: '48946',
    id: '567895',
    date: new Date(),
  },
  {
    ...testUsers[0],
    content: 'Which part?',
    space: '48946',
    id: '567896',
    date: new Date(),
    replied: {
      ...testUsers[2],
      content: 'I was born in Paris.',
      space: '48946',
      id: '567897',
      date: new Date(),
    },
  },
  {
    ...testUsers[2],
    content: 'All of me.',
    space: '48946',
    id: '567898',
    date: new Date(),
  },
];
