import { useState } from 'react';

import { icons, randomGuy } from '@holistix-forge/ui-base';

import { Tabs } from './tabs';
import { UserDisplayItem } from '../assets/user-display-item';

//

type UserListProps = {
  displayTabs?: boolean;
  displayEmail?: boolean;
};

export const UserList = ({ displayEmail, displayTabs }: UserListProps) => {
  const [users, setUsers] = useState<any[]>([]);

  const addUser = (user: any) => {
    setUsers((prevState) => [...prevState, user]);
  };

  return (
    <div className="flex flex-col w-full">
      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
        {displayTabs && (
          <div className="flex items-center" style={{ gap: '14px' }}>
            <icons.SummaryAccess />
            <Tabs
              tabs={[{ tab: 'All' }, { tab: 'Added' }, { tab: 'Filtered' }]}
              currentTabs="All"
            />
          </div>
        )}
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
            placeholder={'rules'}
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
          onClick={() => addUser(randomGuy())}
        >
          <p style={{ fontSize: '16px', color: 'white' }}>Users</p>
          <icons.Plus />
        </div>
      </div>

      <div
        className="flex flex-col"
        style={{ gap: '14px', marginTop: '8px', padding: '0 10px' }}
      >
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
