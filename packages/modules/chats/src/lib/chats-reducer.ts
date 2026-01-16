import { RequestData, TReducersBackendExports } from '@holistix-forge/reducers';
import { makeUuid } from '@holistix-forge/simple-types';
import { TCoreSharedData } from '@holistix-forge/core-graph';
import {
  TCollabBackendExports,
  ReducerWithCollab,
} from '@holistix-forge/collab';
import { TWhiteboardSharedData } from '@holistix-forge/whiteboard';

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

type TRequired = {
  collab: TCollabBackendExports;
  reducers: TReducersBackendExports;
};

/**
 *
 */

export class ChatReducer extends ReducerWithCollab<
  TChatEvent,
  TChatSharedData & TCoreSharedData & TWhiteboardSharedData
> {
  //

  constructor(private exports: TRequired) {
    super(exports.collab.registry, 'chats');
    this.exports = exports;
  }

  reduce(event: TChatEvent, requestData: RequestData): Promise<void> {
    switch (event.type) {
      case 'chats:new-message':
        return this._newMessage(event, requestData);

      case 'chats:new-chat':
        return this._newChat(event, requestData);

      case 'chats:is-writing':
        return this._isWriting(event, requestData);

      case 'chats:user-has-read':
        return this._userHasRead(event, requestData);

      case 'chats:chat-resolve':
        return this._chatResolve(event, requestData);

      case 'chats:delete-message':
        return this._deleteMessage(event, requestData);

      case 'chats:delete':
        return this._deleteChat(event, requestData);

      default:
        return Promise.resolve();
    }
  }

  //

  __deepCopyEditAndApply(
    event: { chatId: string },
    f: (chat: TChat) => void,
    requestData: RequestData
  ) {
    const collab = this.getCollab(requestData);
    const chat = collab.sharedData['chats:chats'].get(event.chatId);
    if (chat) {
      const nchat = structuredClone(chat);
      f(nchat);
      collab.sharedData['chats:chats'].set(event.chatId, nchat);
    }
  }

  //

  _newMessage(
    event: TEventNewMessage,
    requestData: RequestData
  ): Promise<void> {
    this.__deepCopyEditAndApply(
      event,
      (chat) => {
        chat.messages.push({
          user_id: requestData.user_id || 'unknown',
          content: event.content,
          date: new Date().toISOString(),
          replyIndex: event.replyToIndex,
        });
        if (chat.lastRead[requestData.user_id] === chat.messages.length - 2)
          chat.lastRead[requestData.user_id] = chat.messages.length - 1;
      },
      requestData
    );
    return Promise.resolve();
  }

  //

  _newChat(event: TEventNewChat, requestData: RequestData): Promise<void> {
    const collab = this.getCollab(requestData);
    const nc = newChat();
    collab.sharedData['chats:chats'].set(nc.id, nc);

    const anchorNodeId = makeUuid();
    const chatNodeId = makeUuid();

    this.exports.reducers.processEvent(
      {
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
        origin: event.origin,
      },
      requestData
    );

    this.exports.reducers.processEvent(
      {
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
        origin: event.origin
          ? {
              ...event.origin,
              position: {
                x: event.origin.position.x + 100,
                y: event.origin.position.y + 100,
              },
            }
          : undefined,
      },
      requestData
    );

    collab.sharedData['whiteboard:graphViews'].forEach(
      async (gv: any, k: any) => {
        await this.exports.reducers.processEvent(
          {
            type: 'whiteboard:resize-node',
            nid: chatNodeId,
            size: {
              width: 550,
              height: 350,
            },
            viewId: k,
          },
          requestData
        );
      }
    );

    return Promise.resolve();
  }

  //

  _isWriting(event: TEventIsWriting, requestData: RequestData): Promise<void> {
    this.__deepCopyEditAndApply(
      event,
      (chat) => {
        const userId = requestData.user_id || 'unknown';
        chat.isWriting[userId] = event.value;
      },
      requestData
    );
    return Promise.resolve();
  }

  //

  _userHasRead(
    event: TEventUserHasRead,
    requestData: RequestData
  ): Promise<void> {
    this.__deepCopyEditAndApply(
      event,
      (chat) => {
        chat.lastRead[requestData.user_id] = event.index;
      },
      requestData
    );
    return Promise.resolve();
  }

  //

  _chatResolve(
    event: TEventChatResolve,
    requestData: RequestData
  ): Promise<void> {
    this.__deepCopyEditAndApply(
      event,
      (chat) => {
        chat.resolved = event.value;
      },
      requestData
    );
    return Promise.resolve();
  }

  //

  _deleteMessage(
    event: TEventDeleteMessage,
    requestData: RequestData
  ): Promise<void> {
    this.__deepCopyEditAndApply(
      event,
      (chat) => {
        const m = chat.messages[event.index];
        if (m.user_id === requestData.user_id) m.content = '[deleted]';
      },
      requestData
    );
    return Promise.resolve();
  }

  //

  _deleteChat(
    event: TEventDeleteChat,
    requestData: RequestData
  ): Promise<void> {
    const collab = this.getCollab(requestData);
    const chat = collab.sharedData['chats:chats'].get(event.chatId);
    if (chat) {
      collab.sharedData['core-graph:nodes'].forEach((node: any) => {
        if (
          (node.type === 'chat' || node.type === 'chat-anchor') &&
          node.data?.chatId === event.chatId
        ) {
          this.exports.reducers.processEvent(
            {
              type: 'core:delete-node',
              id: node.id,
            },
            requestData
          );
        }
      });
      collab.sharedData['chats:chats'].delete(event.chatId);
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

const newChat = (): TChat => {
  return {
    id: makeUuid(),
    resolved: false,
    messages: [],
    lastRead: {},
    isWriting: {},
  };
};
