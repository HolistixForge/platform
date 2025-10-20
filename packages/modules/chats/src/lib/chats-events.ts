import { TEventOrigin } from '@monorepo/core-graph';

export type ReducersPrivate<T> = {
  __private__?: T;
};

export type TEventNewMessage = {
  type: 'chats:new-message';
  chatId: string;
  content: string;
  replyToIndex?: number;
};

export type TEventDeleteMessage = {
  type: 'chats:delete-message';
  chatId: string;
  index: number;
};

export type TEventIsWriting = {
  type: 'chats:is-writing';
  chatId: string;
  value: boolean;
};

export type TEventUserHasRead = {
  type: 'chats:user-has-read';
  chatId: string;
  index: number;
};

export type TEventChatResolve = {
  type: 'chats:chat-resolve';
  chatId: string;
  value: boolean;
};

export type TEventNewChat = {
  type: 'chats:new-chat';
  origin?: TEventOrigin;
};

export type TEventDeleteChat = {
  type: 'chats:delete';
  chatId: string;
};

export type TChatEvent =
  | TEventNewMessage
  | TEventDeleteMessage
  | TEventIsWriting
  | TEventUserHasRead
  | TEventChatResolve
  | TEventNewChat
  | TEventDeleteChat;
