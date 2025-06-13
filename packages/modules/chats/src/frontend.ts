import './lib/index.scss';
import { NodeChatbox } from './lib/components/node-chat/node-chatbox';
import { NodeChatAnchor } from './lib/components/node-chat-anchor/node-chat-anchor';
import type { ModuleFrontend } from '@monorepo/module/frontend';
import { Chat_loadData } from './lib/chats-shared-model';

export const moduleFrontend: ModuleFrontend = {
  collabChunk: {
    name: 'chats',
    loadSharedData: Chat_loadData,
    deps: [],
  },
  spaceMenuEntries: () => [],
  nodes: {
    chat: NodeChatbox,
    'chat-anchor': NodeChatAnchor,
  },
};
