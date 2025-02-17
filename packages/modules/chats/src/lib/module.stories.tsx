import type { Meta, StoryObj } from '@storybook/react';
import { useMemo } from 'react';

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
import { randomGuys } from '@monorepo/ui-base';
import { Logger } from '@monorepo/log';

import { ChatReducer } from './chats-reducer';
import { Chat_loadData, TChatSharedData } from './chats-shared-model';
import { TChatEvent } from './chats-events';
import { TChat } from './chats-types';
import { ChatboxLogic } from './components/node-chat/chatbox-logic';

//

Logger.setPriority(7);

//

const chunks: TCollaborativeChunk[] = [
  {
    sharedData: (st: SharedTypes) => Chat_loadData(st),
    reducers: (sd: TValidSharedData) => [new ChatReducer()],
  },
];

//

const li =
  'Lorem ipsum dolor sit amet consectetur adipiscing elit Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua Ut enim ad minim veniam quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat';

const makeLoremIpsum = () => {
  const words = li.split(' ');
  const numWords = Math.floor(Math.random() * 20) + 5; // Between 5-25 words
  const punctuation = [',', '.', '!', '?', '...'];

  let result = '';

  for (let i = 0; i < numWords; i++) {
    // Add random word
    const word = words[Math.floor(Math.random() * words.length)];
    result += word;

    // Randomly add punctuation (20% chance)
    if (Math.random() < 0.2) {
      const punct = punctuation[Math.floor(Math.random() * punctuation.length)];
      result += punct;
    }

    result += ' ';
  }

  // Ensure it ends with proper punctuation
  result = result.trim();
  if (!result.match(/[.!?]$/)) {
    result += '.';
  }

  // Capitalize first letter
  return result.charAt(0).toUpperCase() + result.slice(1);
};

//

const StoryWrapper = () => {
  const dispatcher = useMemo(() => {
    // fake users messages
    setInterval(() => {
      const chats = dispatcher._sharedData.chats as SharedMap<TChat>;
      chats.forEach((c) => {
        const randomGuy =
          randomGuys[Math.floor(Math.random() * randomGuys.length)];

        // Send is writing event
        dispatcher.dispatch({
          type: 'chats:is-writing',
          chatId: c.id,
          value: true,
          __dev__user_id: randomGuy.user_id,
        });

        // Wait 2 seconds before sending message
        setTimeout(() => {
          const newMessageEvent = {
            __dev__user_id: randomGuy.user_id,
            type: 'chats:new-message',
            chatId: c.id,
            content: makeLoremIpsum(),
            replyToIndex: Math.floor(Math.random() * c.messages.length),
          };
          dispatcher.dispatch(newMessageEvent);

          // Send stopped writing event
          dispatcher.dispatch({
            type: 'chats:is-writing',
            chatId: c.id,
            value: false,
            __dev__user_id: randomGuy.user_id,
          });
        }, 2000);
      });
    }, 7000);

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

const guys = new Map(randomGuys.map((guy) => [guy.user_id, guy]));

const ChatsGrid = () => {
  const chats: SharedMap<TChat> = useSharedData<TChatSharedData>(
    ['chats'],
    (sd) => sd.chats
  );
  const dispatcher = useDispatcher<TChatEvent>();

  const addChat = () => {
    dispatcher.dispatch({ type: 'chats:new-chat' });
  };

  return (
    <div>
      <button onClick={addChat}>+</button>
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, 450px)',
          gap: '10px',
        }}
      >
        {Array.from(chats.values()).map((chat) => (
          <div key={chat.id} style={{ maxHeight: '650px' }}>
            <ChatboxLogic
              chatId={chat.id}
              usersInfo={guys}
              userId={randomGuys[0].user_id}
            />
          </div>
        ))}
      </div>
    </div>
  );
};

//

const meta = {
  title: 'Module/Chats/Main',
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
