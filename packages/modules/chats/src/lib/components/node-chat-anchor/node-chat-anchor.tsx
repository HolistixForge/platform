import { icons } from '@holistix-forge/ui-base';
import { InputsAndOutputs, useNodeContext } from '@holistix-forge/whiteboard/frontend';
import { useNodeEdges } from '@holistix-forge/core-graph/frontend';
import { TGraphNode } from '@holistix-forge/core-graph';
import { useLocalSharedData } from '@holistix-forge/collab/frontend';
import { useDispatcher } from '@holistix-forge/reducers/frontend';
import { useCurrentUser } from '@holistix-forge/frontend-data';

import { TChatSharedData } from '../../chats-shared-model';
import { TChat } from '../../chats-types';

import './node-chat-anchor.scss';

//

export const NodeChatAnchor = ({ node }: { node: TGraphNode }) => {
  const chatId = node.data!.chatId as string;

  const chat: TChat = useLocalSharedData<TChatSharedData>(
    ['chats:chats'],
    (sd) => sd['chats:chats'].get(chatId)
  );

  const dispatcher = useDispatcher();

  const useNodeValue = useNodeContext();

  const edges = useNodeEdges(node.id);

  const { data: currentUserData, status: currentUserStatus } = useCurrentUser();

  const chatNodeId = edges.length === 1 && edges[0].to.node;

  // we want to open also the chat node
  const handleOpen = () => {
    useNodeValue.open();
    chatNodeId &&
      dispatcher.dispatch({
        type: 'whiteboard:open-node',
        nid: chatNodeId,
        viewId: useNodeValue.viewId,
      });
  };

  const handleClose = () => {
    useNodeValue.close();
    chatNodeId &&
      dispatcher.dispatch({
        type: 'whiteboard:close-node',
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
      <NodeChatAnchorInternal
        nodeId={node.id}
        isOpened={useNodeValue.isOpened}
        onOpen={handleOpen}
        onClose={handleClose}
        status="new"
        showSideComment={!useNodeValue.isOpened}
        unreadCount={unread}
      />
    );

  return null;
};

//

export type NodeChatAnchorInternalProps = {
  nodeId: string;
  isOpened: boolean;
  onOpen: () => void;
  onClose: () => void;
  status?: 'default' | 'resolved' | 'new';
  showSideComment?: boolean;
  title?: string;
  unreadCount: number;
};

export const NodeChatAnchorInternal = ({
  nodeId,
  status,
  showSideComment,
  isOpened,
  onOpen,
  onClose,
  title,
  unreadCount,
}: NodeChatAnchorInternalProps) => {
  return (
    <div className="comment-icon">
      <InputsAndOutputs id={nodeId} top={false} bottomDisabled={true} />
      {!isOpened ? (
        <div onClick={onOpen}>
          <icons.Chat
            style={{
              fill:
                status === 'new'
                  ? 'var(--color-chat-new)'
                  : 'var(--color-chat-default)',
            }}
          />
          {status === 'resolved' && (
            <icons.Check className="resolved-comment" />
          )}
          {unreadCount > 0 && (
            <div className="new-comment">
              <span>{unreadCount}</span>
            </div>
          )}
        </div>
      ) : (
        <div className="comment-round" onClick={onClose} />
      )}

      {showSideComment && title && (
        <div
          onClick={(e) => {
            e.stopPropagation();
          }}
          className={`comment-wrapper ${isOpened ? 'comment-open' : ''}`}
        >
          <div
            style={{
              border:
                status === 'new' ? '1px solid var(--color-chat-new)' : 'none',
              color: status === 'new' ? 'var(--c-white-1)' : 'var(--c-pink-2)',
            }}
            className={`side-comment ${isOpened ? 'side-comment-open' : ''}`}
          >
            <p contentEditable>{title}</p>
          </div>
        </div>
      )}
    </div>
  );
};
