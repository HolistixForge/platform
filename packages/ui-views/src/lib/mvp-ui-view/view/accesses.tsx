import { Sidebar } from '@holistix-forge/ui-base';

import { Header } from '../components/header';
import { ResourceBar } from '../components/resource-bar';
import { FilterBox } from '../components/filter-box';
import { UserList } from '../components/user-list';
import { menuItems } from './access-role';

//

export type AccessesProps = Record<string, never>;

export const Accesses = (_props: AccessesProps) => {
  return (
    <div style={{ width: '1920px', height: '1080px', border: '1px solid' }}>
      <Header hasNotifications />
      <ResourceBar title="Accesses" />
      <div
        className="flex justify-between"
        style={{ paddingLeft: '20px', paddingTop: '7px' }}
      >
        <div className="flex items-center" style={{ gap: '9px' }}>
          <span style={{ fontSize: '9px', color: 'rgba(255,255,255,0.8)' }}>
            Accesses
          </span>
          <div
            style={{
              height: '4px',
              width: '4px',
              borderRadius: '50%',
              backgroundColor: 'rgba(255,255,255,0.2)',
            }}
          />
        </div>
      </div>
      <div
        className="relative flex"
        style={{
          height: 'calc(1080px - 90px)',
          paddingTop: '20px',
          gap: '30px',
        }}
      >
        <Sidebar active={'authorizations'} items={menuItems} />

        <div className="w-full" style={{ marginTop: '16px' }}>
          <section
            className="grid"
            style={{
              paddingTop: '10px',
              width: '100%',
              paddingRight: '50px',
              gridTemplateColumns: 'repeat(12, minmax(0, 1fr))',
              gap: '30px',
            }}
          >
            <div style={{ gridColumn: 'span 4' }}>
              <UserList />
            </div>
            <div
              className="flex flex-col"
              style={{ gridColumn: 'span 4', gap: '20px' }}
            >
              <FilterBox name="Groups" mode="Group" />
            </div>
            <div style={{ gridColumn: 'span 4' }}>
              <FilterBox name="Roles" mode="Role" />
            </div>
          </section>
        </div>
      </div>
    </div>
  );
};
