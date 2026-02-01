import { useState } from 'react';

import { TF_User } from '@holistix-forge/types';
import { UserAvatar, UserUsername, icons } from '@holistix-forge/ui-base';

//

type WrapperProps = {
  tag: string;
  tagSecondary?: string;
  tagColor: string;
  tagSecondaryColor?: string;
  resizeBorderColor: string;
  user?: TF_User;
  displaySettings?: boolean;
  displayRemove?: boolean;
  displayDelete?: boolean;
};

export const Wrapper = ({
  user,
  tag,
  tagColor,
  tagSecondary,
  tagSecondaryColor,
  resizeBorderColor,
  displaySettings,
  displayRemove,
  displayDelete,
}: WrapperProps) => {
  const [displayAll, setDisplayAll] = useState(false);

  return (
    <div className="flex" style={{ gap: '8px' }}>
      <div className="relative w-full">
        <div
          className="flex items-center absolute"
          style={{ left: 0, top: '-28px', gap: '6px' }}
        >
          <div
            className="flex items-center justify-center font-bold"
            style={{
              borderRadius: '4px 4px 0 0',
              color: 'white',
              fontSize: '12px',
              paddingLeft: '8px',
              paddingRight: '8px',
              height: '24px',
              background: tagColor,
            }}
          >
            {tag}
          </div>
          {tagSecondary && (
            <div
              className="flex items-center justify-center font-bold"
              style={{
                borderRadius: '4px',
                color: 'white',
                fontSize: '10px',
                textTransform: 'uppercase',
                paddingLeft: '8px',
                paddingRight: '8px',
                height: '24px',
                background: tagSecondaryColor,
              }}
            >
              {tagSecondary}
            </div>
          )}
        </div>

        <div
          className="relative overflow-hidden flex flex-col"
          style={{
            resize: 'both',
            borderWidth: '2px',
            borderStyle: 'solid',
            borderColor: resizeBorderColor,
            minWidth: '200px',
            height: 'auto',
            borderTopLeftRadius: '1px',
            borderBottomLeftRadius: '4px',
            borderBottomRightRadius: '4px',
            borderTopRightRadius: '4px',
            paddingTop: '12px',
            paddingBottom: '12px',
            gap: '8px',
          }}
        >
          <div
            className="flex flex-wrap"
            style={{ gap: '8px', padding: '0 16px' }}
          >
            <div
              className="font-bold"
              style={{
                backgroundColor: '#1351AE',
                color: 'white',
                borderRadius: '4px',
                fontSize: '12px',
                paddingLeft: '8px',
                paddingRight: '8px',
              }}
            >
              France
            </div>
            <div
              className="font-bold"
              style={{
                backgroundColor: '#1351AE',
                color: 'white',
                borderRadius: '4px',
                fontSize: '12px',
                paddingLeft: '8px',
                paddingRight: '8px',
              }}
            >
              France
            </div>
            <div
              className="font-bold"
              style={{
                backgroundColor: '#1351AE',
                color: 'white',
                borderRadius: '4px',
                fontSize: '12px',
                paddingLeft: '8px',
                paddingRight: '8px',
              }}
            >
              France
            </div>
            <div
              className="font-bold"
              style={{
                backgroundColor: '#1351AE',
                color: 'white',
                borderRadius: '4px',
                fontSize: '12px',
                paddingLeft: '8px',
                paddingRight: '8px',
              }}
            >
              France
            </div>
            <div
              className="font-bold"
              style={{
                backgroundColor: '#1351AE',
                color: 'white',
                borderRadius: '4px',
                fontSize: '12px',
                paddingLeft: '8px',
                paddingRight: '8px',
              }}
            >
              France
            </div>
          </div>

          {user && (
            <div className="flex flex-col" style={{ gap: '8px' }}>
              <div
                className="flex items-center"
                style={{ gap: '4px', padding: '0 16px' }}
              >
                <UserAvatar {...user} size="small" />
                <p style={{ fontSize: '12px', lineHeight: '28px' }}>
                  <UserUsername {...user} />
                </p>
              </div>
              <div
                className="flex items-center"
                style={{ gap: '4px', padding: '0 16px' }}
              >
                <UserAvatar {...user} size="small" />
                <p style={{ fontSize: '12px', lineHeight: '28px' }}>
                  <UserUsername {...user} />
                </p>
              </div>
              <div
                className="flex justify-center items-center font-bold cursor-pointer"
                style={{
                  color: 'white',
                  fontSize: '12px',
                  height: '18px',
                  transition: 'all 0.2s',
                  backgroundColor: displayAll ? '#43436F' : undefined,
                  borderRadius: '0 0 4px 4px',
                }}
                onClick={() => setDisplayAll(!displayAll)}
              >
                {displayAll ? '-' : '+ 10'}
              </div>
              {displayAll && (
                <>
                  <div
                    className="flex items-center"
                    style={{ gap: '4px', padding: '0 16px' }}
                  >
                    <UserAvatar {...user} size="small" />
                    <p style={{ fontSize: '12px', lineHeight: '28px' }}>
                      <UserUsername {...user} />
                    </p>
                  </div>
                  <div
                    className="flex items-center"
                    style={{ gap: '4px', padding: '0 16px' }}
                  >
                    <UserAvatar {...user} size="small" />
                    <p style={{ fontSize: '12px', lineHeight: '28px' }}>
                      <UserUsername {...user} />
                    </p>
                  </div>
                  <div
                    className="flex items-center"
                    style={{ gap: '4px', padding: '0 16px' }}
                  >
                    <UserAvatar {...user} size="small" />
                    <p style={{ fontSize: '12px', lineHeight: '28px' }}>
                      <UserUsername {...user} />
                    </p>
                  </div>
                  <div
                    className="flex items-center"
                    style={{ gap: '4px', padding: '0 16px' }}
                  >
                    <UserAvatar {...user} size="small" />
                    <p style={{ fontSize: '12px', lineHeight: '28px' }}>
                      <UserUsername {...user} />
                    </p>
                  </div>
                </>
              )}
            </div>
          )}
        </div>
      </div>
      <div
        className="flex items-center"
        style={{ gap: '8px', transition: 'opacity 0.3s' }}
      >
        {displaySettings && (
          <div className="cursor-pointer">
            <icons.Settings
              style={{ width: '20px', height: '20px', color: 'white' }}
            />
          </div>
        )}
        {displayRemove && (
          <div className="cursor-pointer">
            <icons.Remove
              style={{ width: '20px', height: '20px', color: 'white' }}
            />
          </div>
        )}
        {displayDelete && (
          <div className="cursor-pointer">
            <icons.Delete style={{ width: '20px', height: '20px' }} />
          </div>
        )}
      </div>
    </div>
  );
};
