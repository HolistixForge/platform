import { Header } from '../components/header';
import { ResourceBar } from '../components/resource-bar';
import { Sidebar } from '../../sidebar/Sidebar';
import { icons } from '../../assets/icons';
import { useState } from 'react';
import { ResourceDescription } from '../components/resource-description';
import { ResourceList } from '../components/resource-list';
import { SummaryAccesses } from '../components/summary-accesses';

export interface NotebookViewProps {
  status: 'running' | 'loading' | 'stopped' | 'hosted';
}

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

export const NotebookView = ({ status }: NotebookViewProps) => {
  const [activeView, setActiveView] = useState('biome-server');
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

  const items = [
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

  return (
    <div className="w-[1920px] h-[1080px] border overflow-auto pb-10">
      <Header hasNotifications host share />
      {activeView === 'biome-server' && (
        <ResourceBar buttonPrimary="" title="Servers" />
      )}
      {activeView === 'biome-server-view' && (
        <ResourceBar
          title="Name_of_server"
          tags={[{ name: 'Server', color: '#45AFDD' }]}
          buttonPrimary="pause"
          warningColor="green"
          tabs={[{ tab: 'Settings' }, { tab: 'Logs' }]}
        />
      )}
      {status === 'hosted' && activeView === 'biome-notebook' && (
        <ResourceBar
          title="Name_of_server"
          tags={[{ name: 'Notebook', color: '#CA922E' }]}
          host
          buttonPrimary="stop"
          buttonSecondary="enter"
          warningColor="blue"
          path="root/app/project_weather/notebook2.ipynb"
        />
      )}
      {status === 'running' && activeView === 'biome-notebook' && (
        <ResourceBar
          title="Name_of_server"
          tags={[{ name: 'Notebook', color: '#CA922E' }]}
          buttonPrimary="stop"
          buttonSecondary="enter"
          warningColor="green"
          path="root/app/project_weather/notebook2.ipynb"
        />
      )}
      {status === 'loading' && activeView === 'biome-notebook' && (
        <ResourceBar
          title="Name_of_server"
          tags={[{ name: 'Notebook', color: '#CA922E' }]}
          buttonPrimary="stop"
          buttonSecondary="enter"
          warningColor="yellow"
          path="root/app/project_weather/notebook2.ipynb"
        />
      )}
      {status === 'stopped' && activeView === 'biome-notebook' && (
        <ResourceBar
          title="Name_of_server"
          tags={[{ name: 'Notebook', color: '#CA922E' }]}
          buttonPrimary="stop"
          buttonSecondary="enter"
          warningColor="red"
          path="root/app/project_weather/notebook2.ipynb"
        />
      )}
      {activeView === 'biome-server-view' && (
        <div className="flex justify-between pl-[7px] pt-[7px]">
          <div className="flex items-center gap-[9px]">
            <span className="text-[9px] text-white/80">Resource</span>
            <div className="h-1 w-1 rounded-full bg-white/20" />
            <span className="text-[9px] text-white/80">
              Server:Name_of_server
            </span>
            <div className="h-1 w-1 rounded-full bg-white/20" />
          </div>

          <div
            className="mr-16 cursor-pointer z-20"
            onClick={() => setActiveView('biome-server')}
          >
            <icons.Close className="cursor-pointer h-[40px] w-[40px]" />
          </div>
        </div>
      )}
      <div
        className={`h-[calc(1080px-90px)] relative ${
          activeView === 'biome-server' && 'pt-[20px]'
        } flex gap-[30px]`}
      >
        <div className={`${activeView === 'biome-server-view' ? 'pt-10' : ''}`}>
          <Sidebar active={'biome'} items={items} />
        </div>

        {activeView === 'biome-server-view' && (
          <div>
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
              <div className="col-span-3">
                <ResourceDescription editing={false} />
              </div>
              <div className="col-span-3">
                <ResourceDescription editing={false} />
              </div>
              <div className="col-span-3">
                <ResourceList
                  setActiveView={setActiveView}
                  displayTabs={false}
                />
              </div>
              <div className="col-span-3">
                <SummaryAccesses activeTab="users" />
              </div>
            </section>
          </div>
        )}
      </div>
    </div>
  );
};
