import { useState } from 'react';

interface TabsProps {
  tabs: {
    tab: string;
    action?: () => void;
  }[];
  currentTabs: string
}

export const Tabs = ({ tabs, currentTabs }: TabsProps) => {
  const [activeTab, setActiveTab] = useState(currentTabs.toLowerCase()); // Initialize with currentTabs index


  return (
    <div className="flex items-center gap-[10px]">
      {tabs.map((tab, index) => (
        <>
          <div
            key={index}
            className={`text-white text-[16px] px-2 font-bold h-[33px] flex items-center justify-center cursor-pointer transition-all rounded-[4px] ${
              (tab.tab as string).toLowerCase() === activeTab ? 'bg-[#2A2A3F] shadow-[0px_2px_8px_rgba(0,0,0,0.20)]' : ''
            }`}
            onClick={() => {
              setActiveTab((tab.tab as string).toLowerCase());
              tab.action && tab.action();
            }}
          >
            {(tab.tab as string)}
          </div>
          {index < tabs.length - 1 && (
            <div className="w-px h-[26px] bg-[#7F7F8C]" />
          )}
        </>
      ))}
    </div>
  );
};
