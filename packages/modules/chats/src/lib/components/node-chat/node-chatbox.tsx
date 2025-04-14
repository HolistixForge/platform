import { useEffect, useState } from 'react';

import {
  InputsAndOutputs,
  TSpaceEvent,
  useMakeButton,
  useNodeContext,
} from '@monorepo/space';
import { TGraphNode, useNodeEdges } from '@monorepo/core';
import { useCurrentUser, useQueriesUsers } from '@monorepo/frontend-data';
import {
  useAwarenessListenData,
  useDispatcher,
  useSharedData,
} from '@monorepo/collab-engine';

import { ChatboxLogic } from './chatbox-logic';
import { TChatSharedData } from '../../chats-shared-model';
import { TChat } from '../../chats-types';
import { TChatEvent } from '../../chats-events';
//

export const NodeChatbox = ({ node }: { node: TGraphNode }) => {
  const chatId = node.data!.chatId as string;

  const chat: TChat = useSharedData<TChatSharedData>(['chats'], (sd) =>
    sd.chats.get(chatId)
  );

  const dispatcher = useDispatcher<TChatEvent | TSpaceEvent>();

  const useNodeValue = useNodeContext();

  const edges = useNodeEdges(useNodeValue.id);

  const { data: currentUserData, status: currentUserStatus } = useCurrentUser();

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

  const placeholder = {
    username: 'Loading...',
    color: 'var(--c-gray-9)',
    picture: null,
  };

  // fill each user's information (name, color) as they beacome ready
  usersId.users.forEach((uid, k) => {
    const q = usersQueries[k];
    const u =
      q.status === 'success'
        ? {
            username: q.data.username,
            color: colors[q.data.username] || placeholder.color,
            picture: q.data.picture,
          }
        : placeholder;
    usersInfo.set(uid, u);
  });

  const anchorNodeId = edges.length === 1 && edges[0].from.node;

  // we want to close the anchor node rather than this node
  const handleClose = () => {
    anchorNodeId &&
      dispatcher.dispatch({
        type: 'space:action',
        action: { type: 'close-node', nid: anchorNodeId },
        viewId: useNodeValue.viewId,
      });
  };

  const handleDelete = () => {
    return dispatcher.dispatch({
      type: 'chats:delete',
      chatId,
    });
  };

  // chat node reduce button is special :
  // reduce button actually close the chat node anchor, so the node disapears
  const buttons = useMakeButton({
    isExpanded: true,
    reduce: handleClose,
    onDelete: handleDelete,
  });

  return (
    <div className="common-node chat-node">
      <InputsAndOutputs id={node.id} bottom={false} topDisabled={true} />
      <ChatboxLogic
        userId={
          (currentUserStatus === 'success' && currentUserData.user.user_id) ||
          undefined
        }
        buttons={buttons}
        chatId={chatId}
        usersInfo={usersInfo}
      />
    </div>
  );
};
