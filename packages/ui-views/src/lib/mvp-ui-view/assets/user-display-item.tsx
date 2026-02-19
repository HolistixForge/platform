import { icons, UserAvatar } from '@holistix-forge/ui-base';
import { TF_User } from '@holistix-forge/types';

//

type UserDisplayItemProps = {
  role: string;
  mail?: string;
  roleColor?: string;
  user: TF_User;
  buttons?: {
    delete?: boolean;
    filter?: boolean;
    settings?: boolean;
    remove?: boolean;
  };
  removeUser?: () => void;
};

export const UserDisplayItem = ({
  user,
  role,
  mail,
  roleColor,
  buttons,
  removeUser,
}: UserDisplayItemProps) => {
  return (
    <div
      className="grid w-full"
      style={{
        gridTemplateColumns: 'repeat(12, minmax(0, 1fr))',
        maxWidth: '100%',
        gap: '20px',
      }}
    >
      <div
        className="flex items-center"
        style={{ gridColumn: mail ? 'span 5' : 'span 7', gap: '8px' }}
      >
        <UserAvatar {...user} size="small" />
        <p
          className="whitespace-nowrap"
          style={{
            fontSize: '12px',
            lineHeight: '28px',
            color: roleColor,
          }}
        >
          {user.firstname} {user.lastname}
        </p>
      </div>
      <div
        className="flex items-center"
        style={{ gridColumn: !mail ? 'span 3' : 'span 5', gap: '8px' }}
      >
        <div
          className="font-bold"
          style={{
            color: 'white',
            borderRadius: '4px',
            fontSize: '12px',
            paddingLeft: '8px',
            paddingRight: '8px',
            backgroundColor: roleColor,
          }}
        >
          {role}
        </div>
        <p style={{ fontSize: '12px', color: '#77768E' }}>
          {mail ? mail : null}
        </p>
      </div>
      <div
        className="flex items-center justify-end"
        style={{ gridColumn: 'span 2', gap: '4px' }}
      >
        {buttons?.settings && (
          <div className="cursor-pointer">
            <icons.Settings
              style={{ width: '20px', height: '20px', color: 'white' }}
            />
          </div>
        )}
        {buttons?.remove && (
          <div className="cursor-pointer">
            <icons.Remove
              style={{ width: '20px', height: '20px', color: 'white' }}
            />
          </div>
        )}
        {buttons?.filter && (
          <div className="cursor-pointer">
            <icons.Filter
              style={{ width: '20px', height: '20px', color: 'white' }}
            />
          </div>
        )}
        {buttons?.delete && (
          <div className="cursor-pointer" onClick={removeUser}>
            <icons.Delete style={{ width: '20px', height: '20px' }} />
          </div>
        )}
      </div>
    </div>
  );
};
