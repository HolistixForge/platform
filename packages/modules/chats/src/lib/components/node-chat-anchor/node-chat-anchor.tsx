import { icons } from '@monorepo/demiurge-ui-components';
import { InputsAndOutputs } from '@monorepo/space';

import './node-chat-anchor.scss';

export type NodeChatAnchorProps = {
  nodeId: string;
  isOpened: boolean;
  onOpen: () => void;
  status?: 'default' | 'resolved' | 'new';
  showSideComment?: boolean;
  title?: string;
  unreadCount: number;
};

export const NodeChatAnchor = ({
  nodeId,
  status,
  showSideComment,
  isOpened,
  onOpen,
  title,
  unreadCount,
}: NodeChatAnchorProps) => {
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
        <div className="comment-round" />
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
