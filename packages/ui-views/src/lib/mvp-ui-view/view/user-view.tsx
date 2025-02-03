import { Header } from '../components/header';
import { ResourceBar } from '../components/resource-bar';
import { Sidebar } from '../../sidebar/Sidebar';
import { icons } from '../../assets/icons';
import { useState } from 'react';
import { ResourceList } from '../components/resource-list';
import { FilterBox } from '../components/filter-box';
import { UserInformations } from '../components/user-informations';
import { menuItems } from './access-role';
import { randomGuy } from '../../utils/random-guys';
import { UserAvatar } from '../../users/users';

export interface UserViewProps {
  editingUser?: boolean;
}

export const UserView = ({ editingUser }: UserViewProps) => {
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

  return (
    <div className="w-[1920px] h-[1080px] border">
      <Header hasNotifications />
      <ResourceBar
        title="Antoine Durand"
        tags={[{ name: 'User', color: '#59C088' }]}
      />
      <div className="flex justify-between pl-[20px] pt-[7px]">
        <div className="flex items-center gap-[9px]">
          <span className="text-[9px] text-white/80">Accesses</span>
          <div className="h-1 w-1 rounded-full bg-white/20" />
          <span className="text-[9px] text-white/80">User:Antoine Durand</span>
          <div className="h-1 w-1 rounded-full bg-white/20" />
        </div>

        <div className="mr-10 cursor-pointer z-20">
          <icons.Close className="cursor-pointer h-[40px] w-[40px]" />
        </div>
      </div>
      <div className="h-[calc(1080px-90px)] relative pt-[20px] flex gap-[30px]">
        <Sidebar active={'authorizations'} items={menuItems} />

        <div className="w-full">
          <section className="min-h-[70px] mr-[50px] w-1/4 flex flex-wrap items-start pt-3 gap-[5px]">
            {tags.map((tag: any) => (
              <Tags text={tag.text} color={tag.color} />
            ))}
            <div
              className="border border-[#50506C] h-5 w-5 rounded-[4px] flex items-center justify-center text-[#50506C] text-center hover:bg-white/20 transition-all cursor-pointer"
              onClick={() => addTag(`tag-${tags.length}`, '#ff0000')}
            >
              <span className="ml-[0.5px] mt-[0.5px] leading-[0%]">+</span>
            </div>
          </section>
          <section className="pt-[10px] w-full pr-[50px] grid grid-cols-12 gap-[30px]">
            <div className="col-span-4 flex flex-col items-center gap-[34px] pt-[50px]">
              <div style={{ '--avatar-width': '167px' } as React.CSSProperties}>
                <UserAvatar {...randomGuy()} />
              </div>
              <UserInformations editing={editingUser} />
            </div>
            <div className="col-span-4 flex flex-col gap-[30px]">
              <FilterBox name="Groups" mode="Group" />
            </div>
            <div className="col-span-4">
              <ResourceList displayTabs={true} />
            </div>
          </section>
        </div>
      </div>
    </div>
  );
};

const Tags = ({ text, color }: { text: string; color?: string }) => {
  return (
    <span
      className={`uppercase bg-[#252546] rounded-[4px] px-2 py-1 text-[10px] font-medium leading-[14px] min-h-[22px] h-[22px] flex items-center w-fit`}
      style={{ color: color }}
      contentEditable={true}
    >
      {text}
    </span>
  );
};
