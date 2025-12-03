import { TF_User } from '@holistix/demiurge-types';
import { UserAvatar } from './users';

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
      className={`relative flex ${
        direction === 'horizontal'
          ? `items-center min-h-[${sz}px] max-h-[${sz}px]`
          : `flex-col items-start min-w-[${sz}px] max-w-[${sz}px]`
      }`}
      style={
        direction === 'horizontal'
          ? { width: `${Math.floor((total - 1) * shift + sz)}px` }
          : { height: `${Math.floor((total - 1) * shift + sz)}px` }
      }
    >
      {live && !displayPlusN && (
        <div
          className={`absolute ${
            size === 'small' ? 'bottom-[2px]' : 'bottom-[4px]'
          } flex items-center h-fit leading-[10px] text-[12px] text-[#f7c8de] text-shadow-pink w-fit gap-[2px]`}
          style={{ zIndex: 110 }}
        >
          <div className="rounded-full conic-gradient-live h-2 w-2 mb-[2px]" />
          Live
        </div>
      )}

      {displayedUsers.map((u, index: number) => (
        <div
          key={index}
          className={`absolute rounded-full`}
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
          className={`absolute ${
            direction === 'horizontal' ? `left-0` : `top-0`
          } z-50 rounded-full flex items-center justify-center max-h-[${sz}px] max-w-[${sz}px] min-h-[${sz}px] min-w-[${sz}px]`}
          style={{
            transform: `${
              direction === 'horizontal'
                ? `translateX(0)`
                : `translateY(${2 * shift}px)`
            }`, // Updated for descending vertical
            zIndex: 110,
          }}
        >
          {live && (
            <div className="absolute -z-10 h-[65%] w-[65%] bg-[#F72585] origin-center rounded-full animate-ping"></div>
          )}
          <div
            className={`relative flex items-center justify-center z-10 h-full w-full rounded-full bg-[#3c2986] ${
              live &&
              'border border-[#F72585] drop-shadow-[0px_0px_4px_#F72585]'
            } ${
              size === 'small'
                ? 'max-h-[38px] max-w-[38px] min-h-[38px] min-w-[38px]'
                : 'max-h-[48px] max-w-[48px] min-h-[48px] min-w-[48px]'
            }  border border-[#451D5F]`}
          >
            +{users.length - 2}
            {live && (
              <div
                className={`absolute ${
                  size === 'small' ? 'bottom-[2px]' : 'bottom-[4px]'
                } flex items-center h-fit leading-[10px] text-[12px] text-[#f7c8de] text-shadow-pink w-fit gap-[2px]`}
              >
                <div className="rounded-full conic-gradient-live h-2 w-2 mb-[2px]" />
                Live
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
