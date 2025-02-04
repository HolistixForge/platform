import { UserUsername } from '@monorepo/demiurge-ui-components';

import './cursor.scss';
import { TF_User } from '@monorepo/demiurge-types';

type CursorProps = {
  fill: 'transparent' | 'color';
} & TF_User;

export const Cursor = ({ fill, ...user }: CursorProps) => {
  return (
    <div className="cursor">
      <CursorIcon
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

//

const CursorIcon = ({ ...props }: React.HTMLAttributes<SVGElement>) => (
  <svg
    {...props}
    width="25"
    height="21"
    viewBox="0 0 25 21"
    xmlns="http://www.w3.org/2000/svg"
  >
    <path
      {...props}
      d="M2 2.38L9.88966 19.38L12.0138 13.09H24L2 2.38Z"
      fill="var(--color-background)"
      className="stroke--c-gray-2"
    />
  </svg>
);
