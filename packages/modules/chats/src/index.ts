import { Chat_loadData } from './lib/chats-shared-model';
import { ChatReducer } from './lib/chats-reducer';
import type { ModuleBackend } from '@monorepo/module';

export const moduleBackend: ModuleBackend = {
  collabChunk: {
    name: 'chats',
    loadSharedData: Chat_loadData,
    loadReducers: (sd) => [new ChatReducer()],
  },
};

export type { TChatSharedData } from './lib/chats-shared-model';

export type { TChatEvent } from './lib/chats-events';
