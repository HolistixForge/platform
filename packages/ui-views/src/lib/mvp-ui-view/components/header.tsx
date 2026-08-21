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
  permissionsLink?: string; // Link to organization permissions page
};

export const Header = ({
  hasNotifications,
  host,
  share,
  user,
  otherUsers,
  logoutAction,
  permissionsLink,
}: HeaderProps) => {
  const NiAction = useNotImplemented();

  return (
    <nav
      className="app-header w-full flex justify-between items-center relative"
      style={{
        height: '46px',
        backgroundColor: '#1D1D42',
        paddingLeft: '24px',
        paddingRight: '24px',
      }}
    >
      <div className="not-bellow-640 flex items-center" style={{ gap: '16px' }}>
        <p style={{ color: 'white', fontSize: '16px' }}>Menu</p>
        <div
          style={{
            borderRadius: '10px',
            backgroundColor: 'rgba(255,255,255,0.2)',
            width: '2px',
            height: '28px',
          }}
        />
        {permissionsLink && (
          <Link to={permissionsLink}>
            <ButtonIcon Icon={icons.Key} actionOriginId="permissions" />
          </Link>
        )}
        <div
          style={{
            borderRadius: '10px',
            backgroundColor: 'rgba(255,255,255,0.2)',
            width: '2px',
            height: '28px',
          }}
        />
        <ButtonIcon
          Icon={icons.RoundedPlus}
          {...NiAction}
          actionOriginId="plus"
        />
        <div
          style={{
            borderRadius: '10px',
            backgroundColor: 'rgba(255,255,255,0.2)',
            width: '2px',
            height: '28px',
          }}
        />
        <ButtonIcon Icon={icons.Delete} {...NiAction} actionOriginId="delete" />
      </div>

      <div className="flex items-center" style={{ gap: '30px' }}>
        <div
          className="header-search not-bellow-640 flex items-center"
          style={{
            backgroundColor: 'rgba(255,255,255,0.05)',
            height: '28px',
            borderRadius: '4px',
            padding: '4px 12px',
            gap: '20px',
          }}
        >
          <ButtonIcon
            Icon={icons.Search}
            {...NiAction}
            actionOriginId="search"
          />
          <input
            className="w-full h-full"
            style={{ fontSize: '14px', color: 'rgba(255,255,255,0.75)' }}
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

      <div className="flex items-center" style={{ gap: '30px' }}>
        <div
          className="not-bellow-640 flex items-center"
          style={{ gap: '20px' }}
        >
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

        <div
          className="flex other-users-container items-center"
          style={{ gap: '10px' }}
        >
          <div className="flex items-center">
            <UserBubble
              users={otherUsers || []}
              direction="horizontal"
              live={false}
              size="small"
              maxUsers={5}
            />
          </div>

          <div
            className="not-bellow-640"
            style={{
              borderRadius: '10px',
              backgroundColor: 'rgba(255,255,255,0.2)',
              width: '2px',
              height: '28px',
            }}
          />

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

              <div
                className="not-bellow-640 flex items-center"
                style={{ gap: '5px' }}
              >
                {/*
                  No credentials padlock here. It is in the rail now, above
                  the accesses — beside the other places a person goes, rather
                  than beside the settings gear, where it read as a preference.
                */}
                <Link to="/account/settings" title="Settings">
                  <ButtonIcon Icon={icons.GearWheel} />
                </Link>

                <div
                  className="relative cursor-pointer"
                  style={{ marginRight: hasNotifications ? '12px' : undefined }}
                >
                  <ButtonIcon
                    Icon={icons.Notification}
                    {...NiAction}
                    actionOriginId="notifications"
                    iconWidth="18px"
                    iconHeight="21px"
                  />

                  {hasNotifications && (
                    <div
                      className="absolute flex items-center justify-center"
                      style={{
                        top: '50%',
                        transform: 'translateY(-50%)',
                        right: '-15px',
                        width: '21px',
                        height: '21px',
                        backgroundColor: '#C43838',
                        borderRadius: '50%',
                        fontSize: '10px',
                      }}
                    >
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
