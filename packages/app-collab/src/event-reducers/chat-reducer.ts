import { ReduceArgs, Reducer, SharedTypes } from '@monorepo/collaborative';
import {
  TChat,
  TChatEvent,
  TChatSharedData,
  TEventChatResolve,
  TEventDeleteMessage,
  TEventIsWriting,
  TEventNewChat,
  TEventNewMessage,
  TEventUserHasRead,
} from '@monorepo/demiurge-types';
import { makeUuid } from '@monorepo/simple-types';

/**
 *
 */

export type TChatReducersExtraArgs = {
  user_id: string;
};

export type Ra<T> = ReduceArgs<
  TChatSharedData,
  T,
  undefined,
  TChatReducersExtraArgs
>;

/**
 *
 */

export class ChatReducer extends Reducer<
  TChatSharedData,
  TChatEvent,
  undefined,
  TChatReducersExtraArgs
> {
  //

  reduce(g: Ra<TChatEvent>): Promise<void> {
    switch (g.event.type) {
      case 'new-message':
        return this._newMessage(g as Ra<TEventNewMessage>);

      case 'new-chat':
        return this._newChat(g as Ra<TEventNewChat>);

      case 'is-writing':
        return this._isWriting(g as Ra<TEventIsWriting>);

      case 'user-has-read':
        return this._userHasRead(g as Ra<TEventUserHasRead>);

      case 'chat-resolve':
        return this._chatResolve(g as Ra<TEventChatResolve>);

      case 'delete-message':
        return this._deleteMessage(g as Ra<TEventDeleteMessage>);

      default:
        return Promise.resolve();
    }
  }

  //

  __deepCopyEditAndApply(g: Ra<{ chatId: string }>, f: (chat: TChat) => void) {
    const chat = g.sd.chats.get(g.event.chatId);
    if (chat) {
      const nchat = structuredClone(chat);
      f(nchat);
      g.sd.chats.set(g.event.chatId, nchat);
    }
  }

  //

  _newMessage(g: Ra<TEventNewMessage>): Promise<void> {
    this.__deepCopyEditAndApply(g, (chat) => {
      chat.messages.push({
        user_id: g.extraArgs.user_id,
        content: g.event.content,
        date: new Date().toISOString(),
        replyIndex: g.event.replyToIndex,
      });
      if (chat.lastRead[g.extraArgs.user_id] === chat.messages.length - 2)
        chat.lastRead[g.extraArgs.user_id] = chat.messages.length - 1;
    });
    return Promise.resolve();
  }

  //

  _newChat(g: Ra<TEventNewChat>): Promise<void> {
    const nc = newChat(g.st, g.event.spaceId);
    g.sd.chats.set(nc.id, nc);
    g.event.__private__ = { id: nc.id };
    return Promise.resolve();
  }

  //

  _isWriting(g: Ra<TEventIsWriting>): Promise<void> {
    this.__deepCopyEditAndApply(g, (chat) => {
      chat.isWriting[g.extraArgs.user_id] = g.event.value;
    });
    return Promise.resolve();
  }

  //

  _userHasRead(g: Ra<TEventUserHasRead>): Promise<void> {
    this.__deepCopyEditAndApply(g, (chat) => {
      chat.lastRead[g.extraArgs.user_id] = g.event.index;
    });
    return Promise.resolve();
  }

  //

  _chatResolve(g: Ra<TEventChatResolve>): Promise<void> {
    this.__deepCopyEditAndApply(g, (chat) => {
      chat.resolved = g.event.value;
    });
    return Promise.resolve();
  }

  //

  _deleteMessage(g: Ra<TEventDeleteMessage>): Promise<void> {
    this.__deepCopyEditAndApply(g, (chat) => {
      const m = chat.messages[g.event.index];
      if (m.user_id === g.extraArgs.user_id) m.content = '[deleted]';
    });
    return Promise.resolve();
  }
}

/**
 *
 *
 *
 *
 */

const newChat = (st: SharedTypes, spaceId?: string): TChat => {
  return {
    id: makeUuid(),
    resolved: false,
    spaceId,
    messages: [],
    lastRead: {},
    isWriting: {},
  };
};
