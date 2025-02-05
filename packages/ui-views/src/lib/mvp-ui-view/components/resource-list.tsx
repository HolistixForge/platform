import { useState } from 'react';

import { icons, randomGuy, randomGuys } from '@monorepo/demiurge-ui-components';

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
          onClick={() => addCard()}
        >
          <p className="text-[16px] text-white">Ressources</p>
          <icons.Plus />
        </div>
      </div>

      <div className="flex flex-col gap-[14px] mt-2 px-[10px]">
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
