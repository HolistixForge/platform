import { ReduceArgs, Reducer, SharedTypes } from '@monorepo/collab-engine';
import { makeUuid } from '@monorepo/simple-types';
import {
  TCoreSharedData,
  TEventDeleteNode,
  TEventNewEdge,
  TEventNewNode,
} from '@monorepo/core';

import {
  TChatEvent,
  TEventChatResolve,
  TEventDeleteMessage,
  TEventIsWriting,
  TEventNewMessage,
  TEventUserHasRead,
  TEventNewChat,
  TEventDeleteChat,
} from './chats-events';
import { TChatSharedData } from './chats-shared-model';
import { TChat } from './chats-types';

/**
 *
 */

type TExtraArgs = {
  user_id: string;
};

type DispatchedEvents = TEventNewNode | TEventNewEdge | TEventDeleteNode;

type Ra<T> = ReduceArgs<
  TChatSharedData & TCoreSharedData,
  T,
  DispatchedEvents,
  TExtraArgs
>;

/**
 *
 */

export class ChatReducer extends Reducer<
  TChatSharedData,
  TChatEvent,
  DispatchedEvents,
  TExtraArgs
> {
  //

  reduce(g: Ra<TChatEvent>): Promise<void> {
    switch (g.event.type) {
      case 'chats:new-message':
        return this._newMessage(g as Ra<TEventNewMessage>);

      case 'chats:new-chat':
        return this._newChat(g as Ra<TEventNewChat>);

      case 'chats:is-writing':
        return this._isWriting(g as Ra<TEventIsWriting>);

      case 'chats:user-has-read':
        return this._userHasRead(g as Ra<TEventUserHasRead>);

      case 'chats:chat-resolve':
        return this._chatResolve(g as Ra<TEventChatResolve>);

      case 'chats:delete-message':
        return this._deleteMessage(g as Ra<TEventDeleteMessage>);

      case 'chats:delete':
        return this._deleteChat(g as Ra<TEventDeleteChat>);

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
        user_id: g.extraArgs.user_id || g.event.__dev__user_id || 'unknown',
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
    const nc = newChat(g.st);
    g.sd.chats.set(nc.id, nc);

    const anchorNodeId = makeUuid();
    const chatNodeId = makeUuid();

    g.bep.process({
      type: 'core:new-node',
      nodeData: {
        type: 'chat-anchor',
        id: anchorNodeId,
        name: `Chat Anchor ${nc.id}`,
        root: true,
        connectors: [{ connectorName: 'outputs', pins: [] }],
        data: { chatId: nc.id },
      },
      edges: [],
      origin: g.event.origin,
    });

    g.bep.process({
      type: 'core:new-node',
      nodeData: {
        type: 'chat',
        id: chatNodeId,
        name: `Chat ${nc.id}`,
        root: false,
        connectors: [{ connectorName: 'inputs', pins: [] }],
        data: { chatId: nc.id },
      },
      edges: [
        {
          from: {
            node: anchorNodeId,
            connectorName: 'outputs',
          },
          to: {
            node: chatNodeId,
            connectorName: 'inputs',
          },
          semanticType: 'referenced_by',
          renderProps: {
            className: ['chat-anchor'],
            edgeShape: 'straight',
          },
        },
      ],
      origin: g.event.origin
        ? {
            ...g.event.origin,
            position: {
              x: g.event.origin.position.x + 100,
              y: g.event.origin.position.y + 100,
            },
          }
        : undefined,
    });

    return Promise.resolve();
  }

  //

  _isWriting(g: Ra<TEventIsWriting>): Promise<void> {
    this.__deepCopyEditAndApply(g, (chat) => {
      const userId = g.extraArgs.user_id || g.event.__dev__user_id || 'unknown';
      chat.isWriting[userId] = g.event.value;
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

  //

  _deleteChat(g: Ra<TEventDeleteChat>): Promise<void> {
    const chat = g.sd.chats.get(g.event.chatId);
    if (chat) {
      g.sd.nodes.forEach((node) => {
        if (
          (node.type === 'chat' || node.type === 'chat-anchor') &&
          node.data?.chatId === g.event.chatId
        ) {
          g.bep.process({
            type: 'core:delete-node',
            id: node.id,
          });
        }
      });
      g.sd.chats.delete(g.event.chatId);
    }
    return Promise.resolve();
  }
}

/**
 *
 *
 *
 *
 */

const newChat = (st: SharedTypes): TChat => {
  return {
    id: makeUuid(),
    resolved: false,
    messages: [],
    lastRead: {},
    isWriting: {},
  };
};
