import type { Meta, StoryObj } from '@storybook/react';
import { useMemo } from 'react';

import { randomGuys } from '@monorepo/ui-base';
import { Logger } from '@monorepo/log';
import { StoryApiContext } from '@monorepo/frontend-data';
import { StoryDemiurgeSpace } from '@monorepo/space/stories';

//
import { loadModules, TModule } from '@monorepo/module';
import { ModuleProvider } from '@monorepo/module/frontend';
import {
  moduleBackend as coreBackend,
  moduleFrontend as coreFrontend,
} from '@monorepo/core-graph';
import {
  moduleBackend as collabBackend,
  TCollabBackendExports,
} from '@monorepo/collab';
import { moduleFrontend as collabFrontend } from '@monorepo/collab/frontend';
import {
  moduleBackend as reducersBackend,
  TReducersBackendExports,
} from '@monorepo/reducers';
import {
  moduleFrontend as reducersFrontend,
  linkDispatchToProcessEvent,
  TReducersFrontendExports,
} from '@monorepo/reducers/frontend';
import { moduleBackend as spaceBackend } from '@monorepo/space';
import { moduleFrontend as spaceFrontend } from '@monorepo/space/frontend';
//

import { moduleFrontend } from '../frontend';
import { moduleBackend, TChatSharedData } from '../';
import { TMyfetchRequest } from '@monorepo/simple-types';

//

Logger.setPriority(7);

const collabConfig = {
  type: 'none',
  room_id: 'space-story',
  simulateUsers: true,
  user: { username: 'test', color: 'red' },
};

const modulesBackend: { module: TModule<never, object>; config: object }[] = [
  {
    module: collabBackend,
    config: collabConfig,
  },
  { module: reducersBackend, config: {} },
  { module: coreBackend, config: {} },
  {
    module: {
      name: 'gateway',
      version: '0.0.1',
      description: 'Gateway module',
      dependencies: ['collab', 'reducers'],
      load: () => {
        //
      },
    },
    config: {},
  },
  { module: spaceBackend, config: {} },
  { module: moduleBackend, config: {} },
  {
    module: {
      name: 'fake-writer',
      version: '0.0.1',
      description: 'Fake writer module',
      dependencies: ['chats'],
      load: ({
        depsExports,
      }: {
        depsExports: {
          collab: TCollabBackendExports<TChatSharedData>;
          reducers: TReducersBackendExports;
        };
      }) => {
        setInterval(() => {
          const chats = depsExports.collab.collab.sharedData['chats:chats'];
          chats.forEach((c) => {
            const randomGuy =
              randomGuys[Math.floor(Math.random() * randomGuys.length)].user_id;

            // Send is writing event
            depsExports.reducers.processEvent(
              {
                type: 'chats:is-writing',
                chatId: c.id,
                value: true,
              },
              {
                ip: '',
                user_id: randomGuy,
                jwt: null,
                headers: {},
              }
            );

            // Wait 4 seconds before sending message
            setTimeout(() => {
              depsExports.reducers.processEvent(
                {
                  type: 'chats:new-message',
                  chatId: c.id,
                  content: makeLoremIpsum(),
                  replyToIndex: Math.floor(Math.random() * c.messages.length),
                },
                {
                  ip: '',
                  user_id: randomGuy,
                  jwt: null,
                  headers: {},
                }
              );

              // Send stopped writing event
              depsExports.reducers.processEvent(
                {
                  type: 'chats:is-writing',
                  chatId: c.id,
                  value: false,
                },
                {
                  ip: '',
                  user_id: randomGuy,
                  jwt: null,
                  headers: {},
                }
              );
            }, 4000);
          });
        }, 7000);
      },
    },
    config: {},
  },
];

const modulesFrontend: { module: TModule<never, object>; config: object }[] = [
  {
    module: collabFrontend,
    config: collabConfig,
  },
  { module: reducersFrontend, config: {} },
  { module: coreFrontend, config: {} },
  { module: spaceFrontend, config: {} },
  { module: moduleFrontend, config: {} },
];

//

const li =
  'Lorem ipsum dolor sit amet consectetur adipiscing elit Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua Ut enim ad minim veniam quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat';

const makeLoremIpsum = () => {
  const words = li.split(' ');
  const numWords = Math.floor(Math.random() * 120) + 5; // Between 5-125 words
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

const ganymedeApiMock = (r: TMyfetchRequest) => {
  console.log(r);
  if (r.url === 'user-by-id') {
    const uid = r.queryParameters?.user_id;
    const user = randomGuys.find((u) => u.user_id === uid);
    console.log({ uid, user });
    if (user) return Promise.resolve({ _0: [user] });
  }
  throw new Error('oops');
};

//

const Story = () => {
  const { frontendModules } = useMemo(() => {
    const backendModules = loadModules(modulesBackend);
    const frontendModules = loadModules(modulesFrontend);

    linkDispatchToProcessEvent(
      backendModules as { reducers: TReducersBackendExports },
      frontendModules as { reducers: TReducersFrontendExports }
    );

    return { backendModules, frontendModules };
  }, []);

  return (
    <StoryApiContext ganymedeApiMock={ganymedeApiMock}>
      <ModuleProvider exports={frontendModules}>
        <div style={{ height: '100vh', width: '100vw' }}>
          <StoryDemiurgeSpace />
        </div>
      </ModuleProvider>
    </StoryApiContext>
  );
};

//

const meta = {
  title: 'Module/Chats/Main',
  component: Story,
  parameters: {
    layout: 'fullscreen',
  },
  argTypes: {},
} satisfies Meta<typeof Story>;

export default meta;

export const Default: StoryObj<typeof Story> = {
  args: {},
};
