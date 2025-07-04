import { TF_User } from '@monorepo/demiurge-types';
import * as Avatar from '@radix-ui/react-avatar';
import { GitHubLogoIcon } from '@radix-ui/react-icons';
import { icons } from '../assets/icons';
import { CSSProperties } from 'react';

import './users.scss';

/**
 * split the username to separate provider and id
 * example: github:FL-AntoineDurand => {user_type: 'github', username: 'FL-AntoineDurand'}
 * @param username
 * @returns
 */
const usernameSplit = (username: string) => {
  const [t1, t2] = username.split(':');
  if (!t2) return { username: t1, user_type: 'none' };
  else return { username: t2, user_type: t1 };
};

export type UserAvatarProps = TF_User & {
  live?: boolean;
  size?: 'small' | 'large';
  host?: boolean;
  removeMarginRight?: boolean;
};

export const UserAvatar = ({
  picture,
  username,
  firstname,
  lastname,
  color,
  live = false,
  host = false,
  size,
  removeMarginRight,
}: UserAvatarProps) => {
  const { username: un } = usernameSplit(username);
  const full = firstname ? `${firstname} ${lastname}` : undefined;
  const initials =
    firstname && lastname ? `${firstname[0]}${lastname[0]}` : un[0];

  const s = {
    '--avatar-width':
      size === 'small' ? '38px' : size === 'large' ? '48px' : undefined,
  };

  const className = `
  ${removeMarginRight && '!mr-0'}
  AvatarRoot
  ${host ? 'border border-[#8498FF] drop-shadow-[0px_0px_4px_#0550B3]' : ''} 
  ${live ? 'border border-[#F72585] drop-shadow-[0px_0px_4px_#F72585]' : ''} 
  rounded-full group/avatar bg-black relative`;

  return (
    <Avatar.Root
      className={className}
      style={s as CSSProperties}
      title={username}
    >
      {live && (
        <div className="absolute -z-10 h-[31px] w-[31px] bg-[#F72585] origin-center rounded-full animate-ping"></div>
      )}
      {host && (
        <div className="absolute -z-10 h-[31px] w-[31px] bg-[#8498FF] origin-center rounded-full animate-ping"></div>
      )}

      {host && (
        <span className="absolute group-hover/avatar:-translate-y-[190%] opacity-0 group-hover/avatar:opacity-100 transition-all left-1/2 -translate-x-1/2 text-[16px] text-host text-[#1032E3] -z-10 p-[2px] rounded-[4px] border border-[#8498FF]">
          <span className="text-stroke-host font-bold">host</span>
        </span>
      )}

      <Avatar.Image
        className="AvatarImage"
        src={picture || undefined}
        alt={full || username}
      />
      <Avatar.Fallback
        className="AvatarFallback"
        delayMs={600}
        style={{ backgroundColor: color }}
      >
        {initials}
      </Avatar.Fallback>
    </Avatar.Root>
  );
};

//

export const UserUsername = ({
  username,
  color = '#fff',
  ellipsis = true,
  style,
}: {
  username: string;
  firstname: string | null;
  lastname: string | null;
  color?: string;
  ellipsis?: boolean;
  style?: CSSProperties;
}) => {
  const { username: un, user_type } = usernameSplit(username);

  const _style = {
    ...style,
    color: color,
    '--user-color': color,
  };

  return (
    <span className={`username ${ellipsis ? 'ellipsis' : ''}`} style={_style}>
      {user_type === 'github' && (
        <GitHubLogoIcon className="user-type github" />
      )}
      {user_type === 'gitlab' && <icons.Gitlab className="user-type gitlab" />}
      {user_type === 'linkedin' && (
        <icons.LinkedIn className="user-type linkedin" />
      )}
      {user_type === 'discord' && (
        <icons.Discord className="user-type discord" />
      )}
      {user_type === 'local' && <span className="user-type local">@</span>}
      {un}
    </span>
  );
};

//

export const UserInline = ({
  picture,
  username,
  firstname,
  lastname,
  color,
}: TF_User & { withAvatar?: boolean; color: string }) => {
  return (
    <div className="user-inline">
      <UserAvatar
        user_id=""
        username={username}
        firstname={firstname}
        lastname={lastname}
        picture={picture}
        color={color}
      />
      <UserUsername
        username={username}
        firstname={firstname}
        lastname={lastname}
        color={color}
      />
    </div>
  );
};
