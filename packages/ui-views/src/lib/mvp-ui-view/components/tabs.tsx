import { useState } from 'react';

//

type TabsProps = {
  tabs: {
    tab: string;
    action?: () => void;
  }[];
  currentTabs: string;
};

export const Tabs = ({ tabs, currentTabs }: TabsProps) => {
  const [activeTab, setActiveTab] = useState(currentTabs.toLowerCase()); // Initialize with currentTabs index

  return (
    <div className="flex items-center" style={{ gap: '10px' }}>
      {tabs.map((tab, index) => (
        <>
          <div
            key={index}
            className="flex items-center justify-center cursor-pointer font-bold"
            style={{
              color: 'white',
              fontSize: '16px',
              paddingLeft: '8px',
              paddingRight: '8px',
              height: '33px',
              transition: 'all 0.2s',
              borderRadius: '4px',
              backgroundColor:
                (tab.tab as string).toLowerCase() === activeTab
                  ? '#2A2A3F'
                  : undefined,
              boxShadow:
                (tab.tab as string).toLowerCase() === activeTab
                  ? '0px 2px 8px rgba(0,0,0,0.20)'
                  : undefined,
            }}
            onClick={() => {
              setActiveTab((tab.tab as string).toLowerCase());
              if (tab.action) {
                tab.action();
              }
            }}
          >
            {tab.tab as string}
          </div>
          {index < tabs.length - 1 && (
            <div
              style={{
                width: '1px',
                height: '26px',
                backgroundColor: '#7F7F8C',
              }}
            />
          )}
        </>
      ))}
    </div>
  );
};
