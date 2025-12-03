import { useState } from 'react';

import { icons, randomGuy } from '@holistix/ui-base';

import { Wrapper } from '../assets/wrapper';

//

type FilterBoxProps = {
  //mode : str Group | Role
  mode: 'Group' | 'Role' | 'Tags';
  name: string;
  user?: boolean;
};

export const FilterBox = ({ mode, name, user }: FilterBoxProps) => {
  const [addFilter, setAddFilter] = useState(1);

  const [tags, setTags] = useState<any>([
    {
      text: 'Boosting',
      color: '#45AFDD',
    },
    {
      text: 'Prediction',
      color: '#F72585',
    },
  ]);

  const addTag = (text: string, color: string) => {
    setTags((prevState: any) => [...prevState, { text, color }]);
  };

  const removeTag = (index: number) => {
    setTags((prevState: any) => {
      const newState = [...prevState];
      newState.splice(index, 1);
      return newState;
    });
  };

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center bg-white/5 h-[28px] w-full rounded-[4px] py-1 px-3 gap-[20px]">
        <div className="cursor-pointer">
          <icons.Search />
        </div>
        <input
          className="w-full h-full text-[14px] text-white/40"
          placeholder={
            mode === 'Group' ? 'Search a node, or a file .....' : 'roles'
          }
        />
        <div className="cursor-pointer">
          <icons.Filter className="w-7 h-7" />
        </div>
      </div>

      <div
        className="flex items-center justify-between rounded-[4px] px-[13px] bg-[#2A2A3F] h-[36px] cursor-pointer"
        onClick={() => {
          if (mode === 'Tags') {
            addTag(`tag-${tags.length}`, '#ff0000');
          } else {
            setAddFilter(addFilter + 1);
          }
        }}
      >
        <p className="text-[16px] text-white">{name}</p>
        <icons.Plus />
      </div>

      {mode === 'Tags' ? (
        <div className="flex flex-col gap-5">
          {tags.map((tag: any, index: number) => (
            <div className="flex items-center justify-between">
              <Tag text={tag.text} color={tag.color} />
              <div className="cursor-pointer" onClick={() => removeTag(index)}>
                <icons.Remove />
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="flex flex-col mt-10 gap-16">
          {
            // eslint-disable-next-line no-plusplus
            Array.from({ length: addFilter }).map((_, index) => (
              <Wrapper
                resizeBorderColor="#7832AF"
                tagColor="#7832AF"
                tag="Data_user_boosting"
                displayRemove
                displayDelete
                displaySettings
                // if user is true, set the user object
                user={user ? randomGuy() : undefined}
              />
            ))
          }
        </div>
      )}
    </div>
  );
};

export const Tag = ({ text, color }: { text: string; color?: string }) => {
  return (
    <span
      className={`uppercase bg-[#252546] rounded-[4px] py-1 px-2 text-[14px] font-medium leading-[14px] min-h-[27px] h-[27px] flex items-center w-fit`}
      style={{ color: color }}
      contentEditable={true}
    >
      {text}
    </span>
  );
};
