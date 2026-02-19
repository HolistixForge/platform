import { Sidebar, icons } from '@holistix-forge/ui-base';

import { Header } from '../components/header';
import { ResourceBar } from '../components/resource-bar';
import { useState } from 'react';
import { ResourceList } from '../components/resource-list';
import { FilterBox } from '../components/filter-box';
import { Rules } from '../components/rules';

//

export type AccessRoleProps = Record<string, never>;

//

export const menuItems = [
  { title: 'planet', Icon: icons.Planet },
  { title: 'solar system', Icon: icons.SolarSystem },
  { title: 'galaxy', Icon: icons.Galaxy },
  { title: 'notetook', Icon: icons.NodeMother },
  { title: 'tree', Icon: icons.Tree },
  { title: 'biome', Icon: icons.Biome },
  { title: 'seed', Icon: icons.Seed },
  { title: 'artefact', Icon: icons.Artefact },
  { title: 'agora', Icon: icons.Agora },
  { title: 'authorizations', Icon: icons.Key },
];

//

export const AccessRole = (_props: AccessRoleProps) => {
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
        title="Montpellier_data"
        tags={[{ name: 'Role', color: '#C25D50' }]}
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
            role:Montpellier_data
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

        <div>
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
            <div style={{ gridColumn: 'span 3' }}>
              <FilterBox name="Resource Tags Filters" mode="Tags" />
            </div>
            <div
              className="flex flex-col"
              style={{ gridColumn: 'span 3', gap: '30px' }}
            >
              <FilterBox name="Roles" mode="Role" />
              <FilterBox name="Groups" mode="Group" />
            </div>
            <div style={{ gridColumn: 'span 3' }}>
              <Rules />
            </div>
            <div style={{ gridColumn: 'span 3' }}>
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
