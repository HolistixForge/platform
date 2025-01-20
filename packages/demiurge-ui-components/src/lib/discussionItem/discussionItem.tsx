import { TrashIcon } from '@radix-ui/react-icons';
import { icons } from '../assets/icons';
import { Datetime } from '../datetime/datetime';
import { NodeToolbar } from '../nodes/node-common/node-toolbar';
import { UserAvatar, UserUsername } from '../users/users';

import './discussionItem.scss';

export type SimpleMessage = {
  username: string;
  picture: string | null;
  content: string;
  color: string;
  space?: string;
  date: Date;
  id: string;
};

export const DiscussionItem = (
  props: SimpleMessage & {
    onReply: (m: SimpleMessage) => void;
    onDelete: (m: SimpleMessage) => void;
    showId?: boolean;
  },
) => {
  const { onReply, onDelete, ...m } = props;
  const { username, picture, content, space, color, id, date } = m;

  return (
    <div className="discussion-item">
      <UserAvatar
        user_id="xxx"
        username={username}
        firstname={''}
        lastname={''}
        picture={picture || ''}
        color={color}
      />
      <div className="discussion-content">
        <div className="discussion-content-header">
          <h4>
            <UserUsername
              username={username}
              firstname={''}
              lastname={''}
              color={color}
            />
          </h4>
          <div className="dot"></div>
          <p className="date">
            <Datetime
              value={date}
              hoverFormats={['short', 'ago']}
              hoverPosition="bottom"
              showIcon
            />
          </p>
          {props.showId && (
            <>
              {space && (
                <>
                  <div className="dot"></div>
                  <p>#{space}</p>
                </>
              )}
              <div className="dot"></div>
              <p>#{id}</p>
            </>
          )}
        </div>
        <p className="content-text">{content}</p>
        <NodeToolbar
          dropDown={false}
          buttons={[
            {
              Icon: icons.Reply,
              callback: () => onReply(m),
            },
            { Icon: TrashIcon, callback: () => onDelete(m) },
          ]}
        />
      </div>
    </div>
  );
};
