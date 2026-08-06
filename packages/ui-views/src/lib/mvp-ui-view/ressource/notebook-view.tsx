import { useEffect, useState } from 'react';

import { Sidebar, icons } from '@holistix-forge/ui-base';

import { Header } from '../components/header';
import { ResourceBar } from '../components/resource-bar';
import { ResourceDescription } from '../components/resource-description';
import { ResourceList } from '../components/resource-list';
import { SummaryAccesses } from '../components/summary-accesses';

//

export type NotebookViewView =
  | 'biome-server'
  | 'biome-server-view'
  | 'biome-notebook';

export type NotebookViewProps = {
  status: 'running' | 'loading' | 'stopped' | 'hosted';
  /**
   * Which of the three screens to open on.
   *
   * It exists because the component could not otherwise leave the first one.
   * `activeView` started at `biome-server`, which has no content block at all —
   * only the header, the resource bar and the sidebar — and the sole way to
   * change it, `setActiveView`, is handed to `ResourceList` inside the
   * `biome-server-view` branch. Reaching that branch required already being in
   * it. So the screen painted its chrome around an empty column and stayed
   * there, and `status` — read only under `biome-notebook` — never affected
   * anything: the four stories rendered byte-identical DOM.
   *
   * It was never otherwise: `git log` over every revision since the file
   * appeared on 2025-02-03 shows `useState('biome-server')` unchanged, and no
   * content block for that view in any of them. The screen was born empty; it
   * is not a regression to bisect.
   *
   * The default is unchanged, so nothing that mounts this component moves.
   */
  view?: NotebookViewView;
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

export const NotebookView = ({
  status,
  view = 'biome-server',
}: NotebookViewProps) => {
  const [activeView, setActiveView] = useState<NotebookViewView>(view);
  // `useState` seeds once, and Storybook re-renders rather than remounting when
  // an arg changes — so toggling the `view` control in the canvas set state
  // nobody read and the screen never switched. Only picking a different story
  // worked, because that remounts.
  useEffect(() => setActiveView(view), [view]);
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
    <div
      className="overflow-auto"
      style={{
        width: '1920px',
        height: '1080px',
        border: '1px solid',
        paddingBottom: '40px',
      }}
    >
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
        <div
          className="flex justify-between"
          style={{ paddingLeft: '7px', paddingTop: '7px' }}
        >
          <div className="flex items-center" style={{ gap: '9px' }}>
            <span style={{ fontSize: '9px', color: 'rgba(255,255,255,0.8)' }}>
              Resource
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
              Server:Name_of_server
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
            style={{ marginRight: '64px', zIndex: 20 }}
            onClick={() => setActiveView('biome-server')}
          >
            <icons.Close
              className="cursor-pointer"
              style={{ height: '40px', width: '40px' }}
            />
          </div>
        </div>
      )}
      <div
        className="relative flex"
        style={{
          height: 'calc(1080px - 90px)',
          paddingTop: activeView === 'biome-server' ? '20px' : undefined,
          gap: '30px',
        }}
      >
        <div
          style={{
            paddingTop: activeView === 'biome-server-view' ? '40px' : undefined,
          }}
        >
          <Sidebar active={'biome'} items={items} />
        </div>

        {activeView === 'biome-server-view' && (
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
                <ResourceDescription editing={false} />
              </div>
              <div style={{ gridColumn: 'span 3' }}>
                <ResourceDescription editing={false} />
              </div>
              <div style={{ gridColumn: 'span 3' }}>
                <ResourceList
                  // ResourceList types this as `(view: string) => void`, so it
                  // can hand back any string. Narrowing here keeps the state
                  // honest without loosening the union the rest of the file
                  // switches on.
                  setActiveView={(v: string) =>
                    setActiveView(v as NotebookViewView)
                  }
                  displayTabs={false}
                />
              </div>
              <div style={{ gridColumn: 'span 3' }}>
                <SummaryAccesses activeTab="users" />
              </div>
            </section>
          </div>
        )}
      </div>
    </div>
  );
};
