import './lib/index.scss';

export type { TChatSharedData } from './lib/chats-shared-model';
export { Chat_loadData } from './lib/chats-shared-model';

export { ChatReducer } from './lib/chats-reducer';

export type { TChatEvent } from './lib/chats-events';

export type {
  NodeChatProps,
  ChatMessage,
} from './lib/components/node-chat/node-chat';
export { NodeChat } from './lib/components/node-chat/node-chat';
export { NodeChatAnchor } from './lib/components/node-chat-anchor/node-chat-anchor';
