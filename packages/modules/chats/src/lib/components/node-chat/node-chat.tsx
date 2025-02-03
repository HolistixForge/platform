import { useEffect, useRef, useState } from 'react';
import EmojiPicker, { Theme } from 'emoji-picker-react';

import {
  useTimer,
  icons,
  SwitchFieldset,
  ButtonIcon,
  ButtonIconProps,
  useAction,
} from '@monorepo/demiurge-ui-components';
import {
  DisablePanSelect,
  TUseNodeValue,
  NodeToolbar,
  InputsAndOutputs,
} from '@monorepo/space';

import { useMakeButton } from '../node-common/node-toolbar';

import {
  DiscussionItem,
  SimpleMessage,
} from '../discussionItem/discussionItem';
import { ReplyItem, ReplyMessage } from '../replyItem/replyItem';

import './node-chat.scss';

//
//

export type ChatMessage = SimpleMessage | ReplyMessage;

export type ChatBoxProps = {
  status?: 'default' | 'resolved' | 'new';
  chatId: string;
  messageList: ChatMessage[];
  onResolve: (resolved: boolean) => void;
  onSendMessage: (msg: string, replyTo?: number) => Promise<void>;
  onCurrentUserWriting?: (write: boolean) => void;
  writingUsers?: { username: string; color: string }[];
  onAllRead?: () => void;
  onDeleteMessage?: (id: string) => void;
  general?: boolean;
  lastRead?: string;
};

//
//

const readStatusFlagsReset = {
  unreadFlagReached: false,
  bottomReached: false,
};

//
//

export const ChatBox = ({
  status,
  chatId,
  messageList,
  onResolve,
  onSendMessage,
  onCurrentUserWriting,
  writingUsers,
  onAllRead,
  onDeleteMessage,
  general = false,
  buttons = [],
  lastRead,
}: ChatBoxProps & { buttons?: ButtonIconProps[] }) => {
  //

  const [replyingTo, setReplyingTo] = useState<number | undefined>(undefined);

  // has the user scroll from unread flag to bottom ?
  const [readStatusFlags, setReadStatusFlags] = useState(readStatusFlagsReset);

  const [showEmoji, setShowEmoji] = useState(false);

  const [message, setMessage] = useState('');

  const chatBodyRef = useRef<HTMLDivElement>(null);

  const { rearm, trigAndStop, isRunning } = useTimer(
    () => onCurrentUserWriting?.(false),
    [onCurrentUserWriting]
  );

  //

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sendButton = useAction<any>(async () => {
    if (message !== '') {
      // console.log('send ------');
      if (isRunning()) trigAndStop();
      await onSendMessage(message, replyingTo);
      setMessage('');
      setReplyingTo(undefined);
    }
  }, [isRunning, message, onSendMessage, replyingTo, trigAndStop]);

  //

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.keyCode === 13) {
      sendButton.callback(undefined);
    } else {
      // notify only if necessary
      if (!isRunning()) onCurrentUserWriting?.(true);
      // refresh timer
      rearm(7000);
    }
  };

  //

  const getUnreadFlagY = () => {
    const d = chatBodyRef.current;
    if (d) {
      const els = d.getElementsByClassName('last-read-flag');
      const flag = (els[0] as HTMLDivElement) || undefined;
      if (flag) return flag.offsetTop;
    }
    return NaN;
  };

  /* scroll to the Unread flag or to the bottom */
  useEffect(() => {
    const d = chatBodyRef.current as HTMLDivElement;
    const y = getUnreadFlagY();
    if (y) d.scrollTop = y;
    else d.scrollTop = d.scrollHeight - d.clientHeight;
    // execute handleScroll for special case when the chat
    // is almost empty and no scroll bar exist
    handleScroll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  //

  /**
   * check if bottom of the chat message is reached
   * or if unread flag is visible. flag both accordingly
   * if both have been reached, mark thread as read.
   */
  const handleScroll = () => {
    // don't bother if callback not set
    if (onAllRead) {
      const t = chatBodyRef.current as HTMLDivElement;
      const fy = getUnreadFlagY();
      if (fy) {
        // is the unread flag visible in the current scroll position
        const flagVisible =
          fy >= t.scrollTop && fy < t.scrollTop + t.clientHeight;
        // are we within 5px from the bottom
        const isBottom = t.scrollTop >= t.scrollHeight - t.clientHeight - 5;
        // console.log({ flagVisible, isBottom });

        // if flags state change
        if (
          (flagVisible && !readStatusFlags.unreadFlagReached) ||
          (isBottom && !readStatusFlags.bottomReached)
        ) {
          const newFlags = {
            unreadFlagReached: readStatusFlags.unreadFlagReached || flagVisible,
            bottomReached: readStatusFlags.bottomReached || isBottom,
          };
          // if both ends have been reached, mark thread as read
          if (newFlags.bottomReached && newFlags.unreadFlagReached) {
            onAllRead();
            setReadStatusFlags(readStatusFlagsReset);
          } else setReadStatusFlags(newFlags);
        }
      }
    }
  };

  //
  //

  return (
    <div
      className={`node-background chat-container ${
        general ? 'chat-general' : ''
      }`}
    >
      <div className="chat-header">
        <div className="chat-infos">
          <div className="sup">
            <icons.Chat
              style={{
                fill: general
                  ? 'var(--c-yellow-1)'
                  : status === 'new'
                  ? 'var(--color-chat-new)'
                  : 'var(--color-chat-default)',
              }}
            />
            <div
              className="badge"
              style={{
                backgroundColor: general
                  ? 'var(--c-yellow-1)'
                  : status === 'new'
                  ? 'var(--color-chat-new)'
                  : 'var(--color-chat-default)',
              }}
            >
              {general ? 'GENERAL CHAT' : 'CHAT'}
            </div>
          </div>
          <p className="id">{general ? 'Dashboard' : `#${chatId}`}</p>
        </div>
        {!general && (
          <SwitchFieldset
            label={status === 'resolved' ? 'Resolved' : 'Resolve'}
            name={'resolved'}
            value={status === 'resolved'}
            onChange={onResolve}
          />
        )}
        <div className="toolbar-box">
          <NodeToolbar buttons={buttons} />
        </div>
      </div>
      <hr />

      <DisablePanSelect>
        <div className="chat-flex-zones">
          <div ref={chatBodyRef} className="chat-body" onScroll={handleScroll}>
            {messageList.map((message, index) => (
              <ChatMessage
                key={message.id}
                message={message}
                index={index}
                lastRead={lastRead}
                onReply={() => setReplyingTo(index)}
                showId={general}
                last={index === messageList.length - 1}
                onDelete={() => onDeleteMessage?.(message.id)}
              />
            ))}
          </div>

          {writingUsers && writingUsers.length > 0 && (
            <div className="bottom-contextual writing-users">
              <p>
                {writingUsers.map((u) => (
                  <span
                    key={u.username}
                    className="writer ellipsis"
                    style={{ color: u.color }}
                  >
                    {u.username}
                  </span>
                ))}
                <span>{writingUsers.length > 1 ? 'are' : 'is'} writing...</span>
              </p>
            </div>
          )}

          {replyingTo !== undefined && (
            <div className="bottom-contextual">
              <ButtonIcon
                Icon={icons.Close}
                callback={() => setReplyingTo(undefined)}
                style={{ border: 'none' }}
              />
              <p>{messageList[replyingTo].content}</p>
            </div>
          )}

          <hr />
          <div className="chat-footer">
            <input
              onKeyDown={(e) => handleKeyDown(e)}
              value={message}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                setMessage(e.target?.value || '')
              }
              placeholder="Reply something, mention with @"
              type="text"
            />
            <button className="emoji" onClick={() => setShowEmoji(!showEmoji)}>
              <icons.Emoji />
            </button>
            <ButtonIcon className="send" Icon={icons.Send} {...sendButton} />
            {showEmoji && (
              <EmojiPicker
                onEmojiClick={(e) => {
                  setShowEmoji(false);
                  setMessage(message + e.emoji);
                }}
                theme={'DARK' as Theme}
              />
            )}
          </div>
        </div>
      </DisablePanSelect>
    </div>
  );
};

//
//
//

const ChatMessage = ({
  message,
  index,
  lastRead,
  showId,
  onReply,
  onDelete,
  last,
}: {
  message: ChatMessage;
  index: number;
  lastRead?: string;
  showId: boolean;
  onReply: () => void;
  onDelete: () => void;
  last: boolean;
}) => {
  const r = message as ReplyMessage;

  return (
    <>
      {
        /* no last read information: assume all is unread, set flag at the thread top */
        lastRead === undefined && index === 0 && (
          <div className="last-read-flag">
            <div>New</div>
          </div>
        )
      }
      {r.replied ? (
        <ReplyItem
          key={r.id}
          {...r}
          onReply={onReply}
          onDelete={onDelete}
          showId={showId}
        />
      ) : (
        <DiscussionItem
          key={message.id}
          {...message}
          onReply={onReply}
          onDelete={onDelete}
          showId={showId}
        />
      )}

      {
        /* with last read information, we put the flag after the last read message
         * except if it is the last of the whole thread */
        !last && lastRead === message.id && (
          <div className="last-read-flag">
            <div>New</div>
          </div>
        )
      }
    </>
  );
};

//
//
//

export type NodeChatProps = ChatBoxProps &
  Pick<TUseNodeValue, 'id' | 'viewStatus' | 'selected' | 'close'>;

export const NodeChat = ({
  id: nodeId,
  viewStatus,
  close,
  ...props
}: NodeChatProps) => {
  // chat node reduce button is special :
  // reduce button actually close the chat node anchor, so the node disapears
  const buttons = useMakeButton({
    isExpanded: true,
    reduce: close,
  });
  return (
    <div className="common-node chat-node">
      <InputsAndOutputs id={nodeId} bottom={false} topDisabled={true} />
      <ChatBox {...props} buttons={buttons} />
    </div>
  );
};
