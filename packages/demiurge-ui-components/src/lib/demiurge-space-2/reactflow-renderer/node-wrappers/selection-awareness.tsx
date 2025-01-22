import { TUseNodeValue } from '../../apis/types/node';
import { UserUsername } from '../../../users/users';

import './selection-awareness.scss';

type SelectionsAwarenessProps = Pick<TUseNodeValue, 'selectingUsers'>;

export const SelectionsAwareness = ({
  selectingUsers,
}: SelectionsAwarenessProps) => {
  //

  return (
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
  );
};
