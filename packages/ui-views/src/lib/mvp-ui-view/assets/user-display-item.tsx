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
    <div className={`grid grid-cols-12 max-w-full gap-[20px] w-full`}>
      <div
        className={`${
          mail ? 'col-span-5' : 'col-span-7'
        } flex items-center gap-[8px]`}
      >
        <UserAvatar {...user} size="small" />
        <p
          className="text-[12px] leading-[28px] whitespace-nowrap"
          style={{
            color: roleColor,
          }}
        >
          {user.firstname} {user.lastname}
        </p>
      </div>
      <div
        className={`${
          !mail ? 'col-span-3' : 'col-span-5'
        } flex items-center gap-2`}
      >
        <div
          className="text-white rounded-[4px] text-[12px] font-bold px-2"
          style={{
            backgroundColor: roleColor,
          }}
        >
          {role}
        </div>
        <p className="text-[12px] text-[#77768E]">{mail ? mail : null}</p>
      </div>
      <div
        className={`${
          mail ? 'col-span-2' : 'col-span-2'
        } flex items-center justify-end gap-1`}
      >
        {buttons?.settings && (
          <div className="cursor-pointer">
            <icons.Settings className="w-5 h-5 text-[white]" />
          </div>
        )}
        {buttons?.remove && (
          <div className="cursor-pointer">
            <icons.Remove className="w-5 h-5 text-[white]" />
          </div>
        )}
        {buttons?.filter && (
          <div className="cursor-pointer">
            <icons.Filter className="w-5 h-5 text-[white]" />
          </div>
        )}
        {buttons?.delete && (
          <div className="cursor-pointer" onClick={removeUser}>
            <icons.Delete className="w-5 h-5" />
          </div>
        )}
      </div>
    </div>
  );
};
