import { useState } from 'react';

import { icons, randomGuy } from '@holistix-forge/ui-base';

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
    <div className="flex flex-col" style={{ gap: '12px' }}>
      <div
        className="flex items-center w-full"
        style={{
          backgroundColor: 'rgba(255,255,255,0.05)',
          height: '28px',
          borderRadius: '4px',
          padding: '4px 12px',
          gap: '20px',
        }}
      >
        <div className="cursor-pointer">
          <icons.Search />
        </div>
        <input
          className="w-full h-full"
          style={{ fontSize: '14px', color: 'rgba(255,255,255,0.4)' }}
          placeholder={
            mode === 'Group' ? 'Search a node, or a file .....' : 'roles'
          }
        />
        <div className="cursor-pointer">
          <icons.Filter style={{ width: '28px', height: '28px' }} />
        </div>
      </div>

      <div
        className="flex items-center justify-between cursor-pointer"
        style={{
          borderRadius: '4px',
          padding: '0 13px',
          backgroundColor: '#2A2A3F',
          height: '36px',
        }}
        onClick={() => {
          if (mode === 'Tags') {
            addTag(`tag-${tags.length}`, '#ff0000');
          } else {
            setAddFilter(addFilter + 1);
          }
        }}
      >
        <p style={{ fontSize: '16px', color: 'white' }}>{name}</p>
        <icons.Plus />
      </div>

      {mode === 'Tags' ? (
        <div className="flex flex-col" style={{ gap: '20px' }}>
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
        <div
          className="flex flex-col"
          style={{ marginTop: '40px', gap: '64px' }}
        >
          {Array.from({ length: addFilter }).map((_, index) => (
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
          ))}
        </div>
      )}
    </div>
  );
};

export const Tag = ({ text, color }: { text: string; color?: string }) => {
  return (
    <span
      className="flex items-center w-fit font-medium"
      style={{
        textTransform: 'uppercase',
        backgroundColor: '#252546',
        borderRadius: '4px',
        paddingTop: '4px',
        paddingBottom: '4px',
        paddingLeft: '8px',
        paddingRight: '8px',
        fontSize: '14px',
        lineHeight: '14px',
        minHeight: '27px',
        height: '27px',
        color: color,
      }}
      contentEditable={true}
    >
      {text}
    </span>
  );
};
