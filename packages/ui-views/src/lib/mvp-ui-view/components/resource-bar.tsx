import { UserAvatar, randomGuy, ResourceButtons } from '@monorepo/ui-base';
import { StatusLed } from '@monorepo/user-containers/frontend';

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
      } w-full h-[50px] px-6 grid grid-cols-12 relative`}
    >
      <div
        className={`flex items-center ${
          tags?.length === 2 ? 'col-span-4' : 'col-span-3'
        } gap-[10px]`}
      >
        {tags && (
          <div className="flex items-center gap-[2px]">
            {tags?.map((tag) => (
              <div
                key={tag.name}
                className={`h-[33px] text-white text-[20px] font-bold px-2 first:rounded-l-[4px] ${
                  tags.length > 1 ? 'last:rounded-r-[4px]' : ''
                }`}
                style={{ backgroundColor: tag.color }}
              >
                {tag.name}
              </div>
            ))}
          </div>
        )}
        <div className="flex items-center gap-[10px]">
          <div className="text-white text-[20px] font-semibold">{title}</div>
          {titleDot && (
            <div
              className="w-[15px] h-[15px] rounded-full"
              style={{
                background: titleDot,
              }}
            />
          )}
        </div>
      </div>

      <div className="col-span-3 flex items-center gap-[30px]">
        <div className="flex items-center gap-2">
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
            <p className="text-[12px] whitespace-nowrap leading-[28px]">
              John Doe
            </p>
          </div>
        ) : null}
      </div>

      {tabs && (
        <div
          className={`${
            tags?.length === 2 ? 'col-span-5' : 'col-span-6'
          } flex items-center bg-gradient-to-r`}
        >
          <Tabs tabs={tabs} currentTabs="Summary" />
        </div>
      )}

      {path !== '' && (
        <p className="absolute right-4 text-[#6C4BA2] text-[14px] leading-[28px] top-1/2 -translate-y-1/2">
          {path}
        </p>
      )}
    </div>
  );
};
