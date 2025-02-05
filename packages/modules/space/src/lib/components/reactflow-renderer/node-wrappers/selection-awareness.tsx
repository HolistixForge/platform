import { TNodeContext } from '../../apis/types/node';
import { UserUsername } from '@monorepo/ui-base';

import './selection-awareness.scss';
import { ReactNode } from 'react';

type SelectionsAwarenessProps = Pick<TNodeContext, 'selectingUsers'> & {
  children: ReactNode;
};

export const SelectionsAwareness = ({
  selectingUsers,
  children,
}: SelectionsAwarenessProps) => {
  //

  return (
    <div
      className={`selection-awareness-box ${
        selectingUsers.length ? 'has-selection' : ''
      }`}
    >
      {children}
      <div className="selections-awareness">
        {selectingUsers.map((u) => (
          <div
            key={`${u.user.username} [${u.viewId}]`}
            style={{ color: u.user.color }}
          >
            <span className="ellipsis">
              <UserUsername
                username={u.user.username}
                color={u.user.color}
                firstname={''}
                lastname={''}
              />
              {`[${u.viewId}]`}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
};
