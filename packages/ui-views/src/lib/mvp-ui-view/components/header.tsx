import React from 'react';
import { Link } from 'react-router-dom';

import {
  icons,
  TAction,
  useNotImplemented,
  UserAvatar,
  ResourceButtons,
  ButtonBase,
  ButtonIcon,
  UserBubble,
} from '@holistix-forge/ui-base';
import { TF_User } from '@holistix-forge/types';

import './header.scss';

//

export type HeaderProps = {
  hasNotifications?: boolean;
  user?: TF_User;
  otherUsers?: TF_User[];
  logoutAction?: TAction;
  share?: boolean;
  host?: boolean;
};

export const Header = ({
  hasNotifications,
  host,
  share,
  user,
  otherUsers,
  logoutAction,
}: HeaderProps) => {
  const NiAction = useNotImplemented();

  return (
    <nav className="app-header w-full h-[46px] flex justify-between items-center bg-[#1D1D42] px-6 relative">
      <div className="not-bellow-640 flex items-center gap-4">
        <p className="text-white text-[16px]">Menu</p>
        <div className="rounded-[10px] bg-white/20 w-[2px] h-[28px]" />
        <ButtonIcon Icon={icons.Save} {...NiAction} actionOriginId="save" />
        <div className="rounded-[10px] bg-white/20 w-[2px] h-[28px]" />
        <ButtonIcon
          Icon={icons.RoundedPlus}
          {...NiAction}
          actionOriginId="plus"
        />
        <div className="rounded-[10px] bg-white/20 w-[2px] h-[28px]" />
        <ButtonIcon Icon={icons.Delete} {...NiAction} actionOriginId="delete" />
      </div>

      <div className="flex items-center gap-[30px]">
        {/*<div className="flex items-center gap-[30px]">
          <div>
            <ButtonIcon
              Icon={icons.SimpleChevron}
              {...NiAction}
              actionOriginId="left"
              iconWidth="10px"
              iconHeight="14px"
            />
            <ButtonIcon
              className="rotate-180"
              Icon={icons.SimpleChevron}
              {...NiAction}
              actionOriginId="right"
              iconWidth="10px"
              iconHeight="14px"
            />
          </div>
        </div>*/}
        <div className="header-search not-bellow-640 flex items-center bg-white/5 h-[28px] rounded-[4px] py-1 px-3 gap-[20px]">
          <ButtonIcon
            Icon={icons.Search}
            {...NiAction}
            actionOriginId="search"
          />
          <input
            className="w-full h-full text-[14px] text-white/75 placeholder:text-white/40"
            placeholder={'Search a node, or a file ....'}
          />
          <ButtonIcon
            style={{ width: '28px' }}
            className="w-7 h-7"
            Icon={icons.Filter}
            {...NiAction}
            actionOriginId="filter"
            iconWidth="28px"
            iconHeight="28px"
          />
        </div>
      </div>

      <div className="flex items-center gap-[30px]">
        <div className="not-bellow-640 flex items-center gap-5">
          {host && (
            <ResourceButtons
              type={'host'}
              size={'small'}
              {...NiAction}
              actionOriginId="host"
              style={{ height: '28px', minHeight: '28px' }}
            />
          )}

          {share && (
            <ResourceButtons
              type={'share'}
              size={'small'}
              {...NiAction}
              actionOriginId="share"
              style={{ height: '28px', minHeight: '28px' }}
            />
          )}
        </div>

        <div className="flex other-users-container items-center gap-[10px]">
          <div className="flex items-center">
            <UserBubble
              users={otherUsers || []}
              direction="horizontal"
              live={false}
              size="small"
              maxUsers={5}
            />
          </div>

          <div className="not-bellow-640 rounded-[10px] bg-white/20 w-[2px] h-[28px]" />

          {user?.username ? (
            <>
              <div
                className="not-bellow-640"
                style={{ '--avatar-width': '38px' } as React.CSSProperties}
              >
                <UserAvatar
                  user_id="xxx"
                  username={user.username}
                  firstname={user.firstname || ''}
                  lastname={user.lastname || ''}
                  picture={user.picture || ''}
                  size="small"
                  removeMarginRight
                />
              </div>

              {logoutAction && (
                <ButtonBase
                  className="small logout not-bellow-640"
                  text="Logout"
                  {...logoutAction}
                />
              )}

              <div className="not-bellow-640 flex items-center gap-[5px]">
                <Link to="/account/settings">
                  <ButtonIcon Icon={icons.GearWheel} />
                </Link>

                <div
                  className={`relative ${
                    hasNotifications && 'mr-3'
                  } cursor-pointer`}
                >
                  <ButtonIcon
                    Icon={icons.Notification}
                    {...NiAction}
                    actionOriginId="notifications"
                    iconWidth="18px"
                    iconHeight="21px"
                  />

                  {hasNotifications && (
                    <div className="absolute top-1/2 -translate-y-1/2 -right-[15px] w-[21px] h-[21px] bg-[#C43838] rounded-full text-[10px] flex items-center justify-center">
                      50
                    </div>
                  )}
                </div>
              </div>
            </>
          ) : (
            <>
              <Link to={`/account/signup`}>
                <ButtonBase className="small signup" text="Sign up" />
              </Link>
              <Link to={`/account/login`}>
                <ButtonBase className="small login" text="Login" />
              </Link>
            </>
          )}
        </div>
      </div>
    </nav>
  );
};
