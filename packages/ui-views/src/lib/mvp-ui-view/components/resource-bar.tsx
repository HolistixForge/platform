import {
  UserAvatar,
  randomGuy,
  ResourceButtons,
} from '@holistix-forge/ui-base';
import { StatusLed } from '@holistix-forge/user-containers/frontend';

import { Tabs } from './tabs';

//

type ResourceBarProps = {
  title: string;
  tags?: {
    name: string;
    color: string;
  }[];
  buttonPrimary?: '' | 'play' | 'stop' | 'pause' | 'enter';
  buttonSecondary?: '' | 'play' | 'stop' | 'pause' | 'enter';
  warningColor?: 'green' | 'red' | 'yellow' | 'blue';
  host?: boolean;
  path?: string;
  tabs?: {
    tab: string;
  }[];
  titleDot?: string;
};

export const ResourceBar = ({
  tags,
  title,
  buttonPrimary,
  buttonSecondary,
  warningColor,
  host,
  path,
  tabs,
  titleDot,
}: ResourceBarProps) => {
  return (
    <div
      className={`${
        tabs ? 'resource-bar-gradient-secondary' : 'resource-bar-gradient'
      } w-full grid relative`}
      style={{
        height: '50px',
        paddingLeft: '24px',
        paddingRight: '24px',
        gridTemplateColumns: 'repeat(12, minmax(0, 1fr))',
      }}
    >
      <div
        className="flex items-center"
        style={{
          gridColumn: tags?.length === 2 ? 'span 4' : 'span 3',
          gap: '10px',
        }}
      >
        {tags && (
          <div className="flex items-center" style={{ gap: '2px' }}>
            {tags?.map((tag, idx) => (
              <div
                key={tag.name}
                className="font-bold"
                style={{
                  height: '33px',
                  color: 'white',
                  fontSize: '20px',
                  paddingLeft: '8px',
                  paddingRight: '8px',
                  backgroundColor: tag.color,
                  borderTopLeftRadius: idx === 0 ? '4px' : undefined,
                  borderBottomLeftRadius: idx === 0 ? '4px' : undefined,
                  borderTopRightRadius:
                    tags.length > 1 && idx === tags.length - 1
                      ? '4px'
                      : undefined,
                  borderBottomRightRadius:
                    tags.length > 1 && idx === tags.length - 1
                      ? '4px'
                      : undefined,
                }}
              >
                {tag.name}
              </div>
            ))}
          </div>
        )}
        <div className="flex items-center" style={{ gap: '10px' }}>
          <div style={{ color: 'white', fontSize: '20px', fontWeight: 600 }}>
            {title}
          </div>
          {titleDot && (
            <div
              style={{
                width: '15px',
                height: '15px',
                borderRadius: '50%',
                background: titleDot,
              }}
            />
          )}
        </div>
      </div>

      <div
        className="flex items-center"
        style={{ gridColumn: 'span 3', gap: '30px' }}
      >
        <div className="flex items-center" style={{ gap: '8px' }}>
          {buttonPrimary && (
            <ResourceButtons size="medium" type={buttonPrimary} />
          )}
          {buttonSecondary && (
            <ResourceButtons size="medium" type={buttonSecondary} />
          )}
        </div>

        {warningColor ? (
          <StatusLed type="resource-bar" color={warningColor} />
        ) : null}

        {host ? (
          <div className="flex items-center">
            <UserAvatar {...randomGuy()} host size="small" />
            <p
              className="whitespace-nowrap"
              style={{ fontSize: '12px', lineHeight: '28px' }}
            >
              John Doe
            </p>
          </div>
        ) : null}
      </div>

      {tabs && (
        <div
          className="flex items-center"
          style={{ gridColumn: tags?.length === 2 ? 'span 5' : 'span 6' }}
        >
          <Tabs tabs={tabs} currentTabs="Summary" />
        </div>
      )}

      {path !== '' && (
        <p
          className="absolute"
          style={{
            right: '16px',
            color: '#6C4BA2',
            fontSize: '14px',
            lineHeight: '28px',
            top: '50%',
            transform: 'translateY(-50%)',
          }}
        >
          {path}
        </p>
      )}
    </div>
  );
};
