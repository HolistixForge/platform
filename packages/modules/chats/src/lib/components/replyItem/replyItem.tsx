import { icons, Datetime, UserUsername } from '@monorepo/ui-base';
import {
  DiscussionItem,
  SimpleMessage,
} from '../discussionItem/discussionItem';

import './replyItem.scss';

export type ReplyMessage = SimpleMessage & {
  replied: SimpleMessage;
};

//

export const ReplyItem = (
  props: ReplyMessage & {
    onReply: (m: SimpleMessage) => void;
    onDelete: (m: SimpleMessage) => void;
    showId?: boolean;
  }
) => {
  const { replied } = props;

  return (
    <div className="reply-item">
      <div className="replyed-to">
        <icons.ReplyShape className="reply-link" style={{}} />
        <div className="reply-wrapper">
          <div className="reply-header">
            <h5>
              <UserUsername
                username={replied.username}
                color={replied.color}
                firstname={''}
                lastname={''}
              />
            </h5>
            <div className="dot"></div>
            <p>
              <Datetime
                value={replied.date}
                hoverFormats={['short', 'ago']}
                hoverPosition="bottom"
              />
            </p>
            {props.showId && (
              <>
                {replied.space && (
                  <>
                    <div className="dot"></div>
                    <p>#{replied.space}</p>
                  </>
                )}
                <div className="dot"></div>
                <p>#{replied.id}</p>
              </>
            )}
          </div>

          <p className="content-text">{replied.content}</p>
        </div>
      </div>
      <DiscussionItem {...props} />
    </div>
  );
};
