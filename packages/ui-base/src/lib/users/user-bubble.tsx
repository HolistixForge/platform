import { TF_User } from '@holistix-forge/types';
import { UserAvatar } from './users';

import './user-bubble.scss';

export interface UserBubbleProps {
  direction: 'horizontal' | 'vertical';
  size: 'small' | 'large';
  live: boolean;
  users: TF_User[];
  maxUsers?: number;
}

export const UserBubble = ({
  users,
  direction,
  live,
  size,
  maxUsers = 3,
}: UserBubbleProps) => {
  const sz = size === 'small' ? 38 : 48;

  const displayedUsers =
    users.length <= maxUsers ? users : users.slice(0, maxUsers - 1);

  const displayPlusN = users.length > maxUsers;

  const total = displayedUsers.length + (displayPlusN ? 1 : 0);

  const shift = sz * 0.66;

  return (
    <div
      className={`user-bubble-root ${direction}`}
      style={
        direction === 'horizontal'
          ? {
              width: `${Math.floor((total - 1) * shift + sz)}px`,
              minHeight: `${sz}px`,
              maxHeight: `${sz}px`,
            }
          : {
              height: `${Math.floor((total - 1) * shift + sz)}px`,
              minWidth: `${sz}px`,
              maxWidth: `${sz}px`,
            }
      }
    >
      {live && !displayPlusN && (
        <div
          className={`live-indicator ${
            size === 'small' ? 'live-small' : 'live-large'
          } text-shadow-pink`}
        >
          <div className="live-dot conic-gradient-live" />
          Live
        </div>
      )}

      {displayedUsers.map((u, index: number) => (
        <div
          key={index}
          className="bubble-avatar-wrapper"
          style={{
            transform: `${
              direction === 'horizontal'
                ? `translateX(${(index + (displayPlusN ? 1 : 0)) * shift}px)`
                : `translateY(${(index + (displayPlusN ? 1 : 0)) * shift}px)`
            }`,
            zIndex: direction === 'horizontal' ? 100 - index * 10 : index * 10,
          }}
        >
          <UserAvatar size={size} {...u} />
        </div>
      ))}

      {displayPlusN && (
        <div
          className={`plus-n-wrapper ${direction}`}
          style={{
            transform: `${
              direction === 'horizontal'
                ? `translateX(0)`
                : `translateY(${2 * shift}px)`
            }`,
            zIndex: 110,
            maxHeight: `${sz}px`,
            maxWidth: `${sz}px`,
            minHeight: `${sz}px`,
            minWidth: `${sz}px`,
          }}
        >
          {live && <div className="plus-n-ping"></div>}
          <div
            className={`plus-n-circle ${live ? 'live-border' : ''} ${
              size === 'small' ? 'size-small' : 'size-large'
            }`}
          >
            +{users.length - 2}
            {live && (
              <div
                className={`live-indicator ${
                  size === 'small' ? 'live-small' : 'live-large'
                } text-shadow-pink`}
              >
                <div className="live-dot conic-gradient-live" />
                Live
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
