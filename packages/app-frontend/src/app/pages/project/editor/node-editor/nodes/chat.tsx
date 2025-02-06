import { useEffect, useState } from 'react';

import { useNodeContext, getNodeEdges } from '@monorepo/space';
import { TNodeChat } from '@monorepo/demiurge-types';
import {
  ChatMessage,
  NodeChat,
  NodeChatAnchor,
  NodeChatProps,
} from '@monorepo/chats';
import { useCurrentUser, useQueriesUsers } from '@monorepo/frontend-data';
import { useAwarenessListenData } from '@monorepo/collab-engine';

import {
  useDispatcher,
  useSharedData,
} from '../../../model/collab-model-chunk';

//

const loading = {
  username: 'Loading...',
  color: 'var(--c-gray-9)',
  picture: null,
};

//

const useNodeEdges = (id: string) => {
  const { edges: allEdges } = useSharedData(['edges'], (sd) => sd);
  const nodeEdges = getNodeEdges(allEdges?.toArray() || [], id);
  return nodeEdges;
};

/**
 * TODO: perf test and refacto
 */

export const ChatNodeLogic = ({
  id: nodeId,
  chatId,
}: TNodeCommon & TNodeChat) => {
  //

  const dispatcher = useDispatcher();
  const useNodeValue = useNodeContext();
  const edges = useNodeEdges(useNodeValue.id);
  const { data: currentUserData, status: currentUserStatus } = useCurrentUser();
  const chat = useSharedData(['chats'], (sd) => sd.chats.get(chatId));

  //
  // maintain a map of user's colors
  //

  const [colors, setColors] = useState<{ [k: string]: string }>({});

  useAwarenessListenData(({ states }) => {
    // prepare a map of all connected users's color
    const cs: { [k: string]: string } = {};
    states.forEach((a) => {
      if (a.user) cs[a.user.username] = a.user.color;
    });
    setColors(cs);
  }, []);

  //
  //

  // init an empty array of needed users ids
  const [usersId, setUsersId] = useState({
    serialized: '',
    users: [] as string[],
  });

  // whenever message list changes, build again the needed users array
  useEffect(() => {
    const authors = chat?.messages.map((m) => m.user_id) || [];
    const writers = chat ? Object.keys(chat.isWriting) : [];

    const uniqueSet = new Set(authors.concat(writers));
    // Convert Set back to an array
    const uniqueArray = Array.from(uniqueSet);
    // Sort the unique array
    uniqueArray.sort();
    const serialized = uniqueArray.join(',');

    if (serialized !== usersId.serialized)
      setUsersId({ serialized, users: uniqueArray });
  }, [chat, chat?.isWriting, chat?.messages, usersId.serialized]);

  // queries for each needed user
  const usersQueries = useQueriesUsers(usersId.users);

  // init an empty Map of users's information
  const usersInfo = new Map<
    string,
    { username: string; color: string; picture: string | null }
  >();

  // fill each user's information (name, color) as they beacome ready
  usersId.users.forEach((uid, k) => {
    const q = usersQueries[k];
    const u =
      q.status === 'success'
        ? {
            username: q.data.username,
            color: colors[q.data.username] || loading.color,
            picture: q.data.picture,
          }
        : loading;
    usersInfo.set(uid, u);
  });

  //
  // build the all resolved message list to pass to UI component

  const messageList: ChatMessage[] =
    chat?.messages.map((m, k) => {
      const u = usersInfo.get(m.user_id) || loading;

      let replied = undefined;
      if (m.replyIndex) {
        const mr = chat.messages[m.replyIndex];
        const ur = usersInfo.get(mr.user_id) || loading;

        replied = {
          username: ur.username,
          picture: null,
          content: chat.messages[m.replyIndex].content,
          color: ur.color,
          space: 'todo',
          date: new Date(),
          id: `${m.replyIndex}`,
        };
      }

      const cm: ChatMessage = {
        username: u.username,
        picture: u.picture,
        content: m.content,
        color: u.color,
        space: 'todo',
        date: new Date(m.date),
        id: `${k}`,
        replied,
      };
      return cm;
    }) || [];

  //
  //

  const anchorNodeId = edges.length === 1 && edges[0].from.node;

  // we want to close the anchor node rather than this node
  const handleClose = () => {
    anchorNodeId &&
      dispatcher.dispatch({
        type: 'close-node',
        nid: anchorNodeId,
        viewId: useNodeValue.viewId,
      });
  };

  const handleSendMessage = (msg: string, replyTo?: number) => {
    return dispatcher.dispatch({
      type: 'new-message',
      chatId,
      content: msg,
      replyToIndex: replyTo,
    });
  };

  const handleCurrentUserWriting = (w: boolean) => {
    dispatcher.dispatch({
      type: 'is-writing',
      chatId,
      value: w,
    });
  };

  const writingUsers: NodeChatProps['writingUsers'] = [];
  if (chat) {
    Object.keys(chat.isWriting).forEach((k) => {
      if (
        currentUserStatus !== 'success' ||
        k !== currentUserData.user.user_id
      ) {
        const u = chat.isWriting[k];
        if (u) {
          writingUsers.push(usersInfo.get(k) || loading);
        }
      }
    });
  }

  const handleResolve = () => {
    if (chat)
      dispatcher.dispatch({
        type: 'chat-resolve',
        chatId,
        value: !chat.resolved,
      });
  };

  const handleDeleteMessage = (id: string) => {
    if (chat)
      dispatcher.dispatch({
        type: 'delete-message',
        chatId,
        index: parseInt(id),
      });
  };

  const handleAllRead = () => {
    if (chat)
      dispatcher.dispatch({
        type: 'user-has-read',
        chatId,
        index: chat?.messages.length - 1,
      });
  };

  const lastRead =
    chat && currentUserStatus === 'success' && currentUserData.user.user_id
      ? chat.lastRead[currentUserData.user.user_id]
      : undefined;

  return (
    <NodeChat
      status={chat?.resolved ? 'resolved' : 'new'}
      chatId={chatId}
      messageList={messageList}
      onResolve={handleResolve}
      onSendMessage={handleSendMessage}
      onCurrentUserWriting={handleCurrentUserWriting}
      writingUsers={writingUsers}
      onAllRead={handleAllRead}
      lastRead={lastRead ? `${lastRead}` : undefined}
      onDeleteMessage={handleDeleteMessage}
      {...useNodeValue}
      close={handleClose}
    />
  );
};

/**
 *
 */

export const ChatAnchorNodeLogic = ({
  id: nodeId,
  chatId,
}: TNodeCommon & TNodeChat) => {
  const dispatcher = useDispatcher();
  const useNodeValue = useNodeContext();
  const edges = useNodeEdges(nodeId);
  const { data: currentUserData, status: currentUserStatus } = useCurrentUser();
  const chat = useSharedData(['chats'], (sd) => sd.chats.get(chatId));

  const chatNodeId = edges.length === 1 && edges[0].to.node;

  // we want to open also the chat node
  const handleOpen = () => {
    useNodeValue.open();
    chatNodeId &&
      dispatcher.dispatch({
        type: 'open-node',
        nid: chatNodeId,
        viewId: useNodeValue.viewId,
      });
  };

  let unread = 0;
  if (chat && currentUserStatus === 'success' && currentUserData.user.user_id) {
    const lastReadIndex = chat.lastRead[currentUserData.user.user_id];
    if (lastReadIndex) {
      unread = chat.messages.length - 1 - lastReadIndex;
    }
  }

  if (chat)
    return (
      <NodeChatAnchor
        nodeId={nodeId}
        isOpened={useNodeValue.isOpened}
        onOpen={handleOpen}
        status="new"
        showSideComment={!useNodeValue.isOpened}
        unreadCount={unread}
      />
    );

  return null;
};
