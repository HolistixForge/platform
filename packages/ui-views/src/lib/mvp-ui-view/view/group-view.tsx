import { useState } from 'react';

import { Sidebar, icons } from '@holistix-forge/ui-base';

import { Header } from '../components/header';
import { ResourceBar } from '../components/resource-bar';
import { ResourceList } from '../components/resource-list';
import { FilterBox } from '../components/filter-box';
import { UserList } from '../components/user-list';
import { menuItems } from './access-role';

//

export type GroupViewProps = Record<string, never>;

export const GroupView = (_props: GroupViewProps) => {
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
    <div style={{ width: '1920px', height: '1080px', border: '1px solid' }}>
      <Header hasNotifications />
      <ResourceBar
        title="team_sync-14"
        tags={[{ name: 'Group', color: '#AA5ECE' }]}
      />
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
          <span style={{ fontSize: '9px', color: 'rgba(255,255,255,0.8)' }}>
            User:Antoine Durand
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

        <div
          className="cursor-pointer"
          style={{ marginRight: '40px', zIndex: 20 }}
        >
          <icons.Close
            className="cursor-pointer"
            style={{ height: '40px', width: '40px' }}
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

        <div className="w-full">
          <section
            className="flex flex-wrap items-start"
            style={{
              minHeight: '70px',
              marginRight: '50px',
              width: '25%',
              paddingTop: '12px',
              gap: '5px',
            }}
          >
            {tags.map((tag: any) => (
              <Tags text={tag.text} color={tag.color} />
            ))}
            <div
              className="flex items-center justify-center text-center cursor-pointer"
              style={{
                border: '1px solid #50506C',
                height: '20px',
                width: '20px',
                borderRadius: '4px',
                color: '#50506C',
                transition: 'all 0.2s',
              }}
              onClick={() => addTag(`tag-${tags.length}`, '#ff0000')}
            >
              <span
                style={{
                  marginLeft: '0.5px',
                  marginTop: '0.5px',
                  lineHeight: '0%',
                }}
              >
                +
              </span>
            </div>
          </section>
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
            <div
              className="flex flex-col"
              style={{ gridColumn: 'span 4', gap: '50px' }}
            >
              <FilterBox name="User Tags Filters" mode="Tags" />
              <FilterBox name="Roles" mode="Group" />
            </div>
            <div style={{ gridColumn: 'span 4' }}>
              <UserList displayTabs />
            </div>
            <div style={{ gridColumn: 'span 4' }}>
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
      className="flex items-center w-fit font-medium"
      style={{
        textTransform: 'uppercase',
        backgroundColor: '#252546',
        borderRadius: '4px',
        paddingLeft: '8px',
        paddingRight: '8px',
        paddingTop: '4px',
        paddingBottom: '4px',
        fontSize: '10px',
        lineHeight: '14px',
        minHeight: '22px',
        height: '22px',
        color: color,
      }}
      contentEditable={true}
    >
      {text}
    </span>
  );
};
