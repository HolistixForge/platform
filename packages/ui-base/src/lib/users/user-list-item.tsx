import { ReactNode } from 'react';
import { UserAvatar, UserUsername } from './users';
import { TCollaborator } from '@holistix-forge/types';

import './user-list-item.scss';

export interface UserListItemProps {
  collaborator: TCollaborator;
  onClick?: () => void;
  children?: ReactNode;
}

export const UserListItem = ({
  collaborator,
  onClick,
  children,
}: UserListItemProps) => {
  return (
    <div
      className="user-list-item"
      onClick={onClick}
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
      onKeyDown={
        onClick
          ? (e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                onClick();
              }
            }
          : undefined
      }
    >
      <div className="user-info">
        <UserAvatar {...collaborator} />
        <UserUsername {...collaborator} />
      </div>
      {children && <div className="user-actions">{children}</div>}
    </div>
  );
};
