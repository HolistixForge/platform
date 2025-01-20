import { TEventOrigin } from '../demiurge-space/events';

export type ReducersPrivate<T> = {
  __private__?: T;
};

export type TEventNewMessage = {
  type: 'new-message';
  chatId: string;
  content: string;
  replyToIndex?: number;
};

export type TEventDeleteMessage = {
  type: 'delete-message';
  chatId: string;
  index: number;
};

export type TEventNewChat = {
  type: 'new-chat';
  spaceId?: string;
} & TEventOrigin &
  ReducersPrivate<{ id: string }>;

export type TEventIsWriting = {
  type: 'is-writing';
  chatId: string;
  value: boolean;
};

export type TEventUserHasRead = {
  type: 'user-has-read';
  chatId: string;
  index: number;
};

export type TEventChatResolve = {
  type: 'chat-resolve';
  chatId: string;
  value: boolean;
};

export type TChatEvent =
  | TEventNewMessage
  | TEventDeleteMessage
  | TEventNewChat
  | TEventIsWriting
  | TEventUserHasRead
  | TEventChatResolve;
