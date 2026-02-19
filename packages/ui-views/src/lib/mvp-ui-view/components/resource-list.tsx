import { useState } from 'react';

import { icons, randomGuy, randomGuys } from '@holistix-forge/ui-base';

import { NotebookCard } from './notebook-card';
import { Tabs } from './tabs';

//

type NotebookCardProps = {
  displayTabs?: boolean;
  setActiveView?: (view: string) => void;
};

export const ResourceList = ({
  displayTabs,
  setActiveView,
}: NotebookCardProps) => {
  const [cards, setCards] = useState<any[]>([
    {
      status: 'running',
    },
  ]);

  const addCard = () => {
    setCards((prevState) => [
      ...prevState,
      {
        status: 'running',
        liveUsers: randomGuys,
        host: randomGuy(),
        tags: [{ text: 'Lorem-Ipsum', color: '#ffa500' }],
        groups: true,
      },
    ]);
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
          className="flex items-center w-full cursor-pointer"
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
          onClick={() => addCard()}
        >
          <p style={{ fontSize: '16px', color: 'white' }}>Ressources</p>
          <icons.Plus />
        </div>
      </div>

      <div
        className="flex flex-col"
        style={{ gap: '14px', marginTop: '8px', padding: '0 10px' }}
      >
        {cards.map((card, index) => (
          <div
            key={index}
            onClick={() => setActiveView?.('biome-notebook')}
            className="cursor-pointer"
          >
            <NotebookCard key={index} {...card} />
          </div>
        ))}
      </div>
    </div>
  );
};
