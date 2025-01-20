import { TF_User } from '@monorepo/demiurge-types';
import { icons } from '../../../../assets/icons';
import { UserUsername } from '../../../../users/users';

import './cursor.scss';

type CursorProps = {
  fill: 'transparent' | 'color';
} & TF_User;

export const Cursor = ({ fill, ...user }: CursorProps) => {
  return (
    <div className="cursor">
      <icons.Cursor
        className={fill === 'transparent' ? 'transparent-cursor' : ''}
        style={{
          fill: fill === 'color' ? user.color : 'transparent',
        }}
      />
      <span
        className={fill === 'transparent' ? 'd-none' : `label-cursor`}
        style={{
          color: fill === 'color' ? user.color : 'transparent',
        }}
      >
        <UserUsername {...user} color={user.color || '#fff'} />
      </span>
    </div>
  );
};
