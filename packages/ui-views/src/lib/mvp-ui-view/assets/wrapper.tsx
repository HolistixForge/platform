import { useState } from 'react';

import { TF_User } from '@holistix/demiurge-types';
import { UserAvatar, UserUsername, icons } from '@holistix/ui-base';

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
    <div className="flex gap-2">
      <div className="relative w-full">
        <div className="flex items-center absolute left-0 -top-7 gap-[6px]">
          <div
            className="rounded-t-[4px] text-white text-[12px] font-bold px-2 h-[24px] flex items-center justify-center"
            style={{
              background: tagColor,
            }}
          >
            {tag}
          </div>
          {tagSecondary && (
            <div
              className="rounded-[4px] text-white text-[10px] uppercase font-bold px-2 flex items-center justify-center h-[24px]"
              style={{
                background: tagSecondaryColor,
              }}
            >
              {tagSecondary}
            </div>
          )}
        </div>

        <div
          className="resize relative overflow-hidden border-2 min-w-[200px] h-auto rounded-tl-[1px] rounded-b-[4px] rounded-tr-[4px] py-3 flex flex-col gap-2"
          style={{ borderColor: resizeBorderColor }}
        >
          <div className="flex flex-wrap gap-2 px-4">
            <div className="bg-[#1351AE] text-white rounded-[4px] text-[12px] font-bold px-2">
              France
            </div>
            <div className="bg-[#1351AE] text-white rounded-[4px] text-[12px] font-bold px-2">
              France
            </div>
            <div className="bg-[#1351AE] text-white rounded-[4px] text-[12px] font-bold px-2">
              France
            </div>
            <div className="bg-[#1351AE] text-white rounded-[4px] text-[12px] font-bold px-2">
              France
            </div>
            <div className="bg-[#1351AE] text-white rounded-[4px] text-[12px] font-bold px-2">
              France
            </div>
          </div>

          {user && (
            <div className="flex flex-col gap-2">
              <div className="flex items-center gap-1 px-4">
                <UserAvatar {...user} size="small" />
                <p className="text-[12px] leading-[28px]">
                  <UserUsername {...user} />
                </p>
              </div>
              <div className="flex items-center gap-1 px-4">
                <UserAvatar {...user} size="small" />
                <p className="text-[12px] leading-[28px]">
                  <UserUsername {...user} />
                </p>
              </div>
              <div
                className={`flex justify-center items-center text-white text-[12px] font-bold h-[18px] transition-all ${
                  displayAll ? 'bg-[#43436F]' : 'hover:bg-[#43436F]'
                } rounded-b-[4px] cursor-pointer`}
                onClick={() => setDisplayAll(!displayAll)}
              >
                {displayAll ? '-' : '+ 10'}
              </div>
              {displayAll && (
                <>
                  <div className="flex items-center gap-1 px-4">
                    <UserAvatar {...user} size="small" />
                    <p className="text-[12px] leading-[28px]">
                      <UserUsername {...user} />
                    </p>
                  </div>
                  <div className="flex items-center gap-1 px-4">
                    <UserAvatar {...user} size="small" />
                    <p className="text-[12px] leading-[28px]">
                      <UserUsername {...user} />
                    </p>
                  </div>
                  <div className="flex items-center gap-1 px-4">
                    <UserAvatar {...user} size="small" />
                    <p className="text-[12px] leading-[28px]">
                      <UserUsername {...user} />
                    </p>
                  </div>
                  <div className="flex items-center gap-1 px-4">
                    <UserAvatar {...user} size="small" />
                    <p className="text-[12px] leading-[28px]">
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
        className={`flex items-center gap-2 transition-opacity duration-300`} // Manage opacity
      >
        {displaySettings && (
          <div className="cursor-pointer">
            <icons.Settings className="w-5 h-5 text-[white]" />
          </div>
        )}
        {displayRemove && (
          <div className="cursor-pointer">
            <icons.Remove className="w-5 h-5 text-[white]" />
          </div>
        )}
        {displayDelete && (
          <div className="cursor-pointer">
            <icons.Delete className="w-5 h-5" />
          </div>
        )}
      </div>
    </div>
  );
};
