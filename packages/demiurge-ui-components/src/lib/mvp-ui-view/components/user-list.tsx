import { Tabs } from './tabs';
import { icons } from '../../assets/icons';
import { useState } from 'react';
import { UserDisplayItem } from '../assets/user-display-item';
import { randomGuy } from '../../utils/random-guys';

interface UserListProps {
  displayTabs?: boolean;
  displayEmail?: boolean;
}

export const UserList = ({ displayEmail, displayTabs }: UserListProps) => {
  const [users, setUsers] = useState<any[]>([]);

  const addUser = (user: any) => {
    setUsers((prevState) => [...prevState, user]);
  };

  return (
    <div className="flex flex-col w-full">
      <div className="space-y-[10px]">
        {displayTabs && (
          <div className="flex items-center gap-[14px]">
            <icons.SummaryAccess />
            <Tabs
              tabs={[{ tab: 'All' }, { tab: 'Added' }, { tab: 'Filtered' }]}
              currentTabs="All"
            />
          </div>
        )}
        <div className="flex items-center bg-white/5 h-[28px] w-full rounded-[4px] py-1 px-3 gap-[20px]">
          <div className="cursor-pointer">
            <icons.Search />
          </div>
          <input
            className="w-full h-full text-[14px] text-white/40"
            placeholder={'rules'}
          />
          <div className="cursor-pointer">
            <icons.Filter className="w-7 h-7" />
          </div>
        </div>
        <div
          className="flex items-center justify-between rounded-[4px] px-[13px] bg-[#2A2A3F] h-[36px] cursor-pointer"
          onClick={() => addUser(randomGuy())}
        >
          <p className="text-[16px] text-white">Users</p>
          <icons.Plus />
        </div>
      </div>

      <div className="flex flex-col gap-[14px] mt-2 px-[10px]">
        {users.map((user, index) => (
          <UserDisplayItem
            user={user}
            role="admin"
            buttons={{
              settings: true,
              remove: true,
            }}
            roleColor="#bf8e2d"
            mail={displayEmail ? 'chrys.beltran@outlook.fr' : undefined}
          />
        ))}
      </div>
    </div>
  );
};
