import { useState } from 'react';

import { Sidebar, icons, SelectFieldset, SelectItem } from '@monorepo/ui-base';

import { Header } from '../components/header';
import { ResourceBar } from '../components/resource-bar';
import { ResourceDescription } from '../components/resource-description';
import { SummaryAccesses } from '../components/summary-accesses';
import { menuItems } from './access-role';
import { awsInstanceTypes } from '@monorepo/servers/frontend';

//

export type NotebookViewProps = {
  updateDescription: boolean;
};

export const NotebookView = ({ updateDescription }: NotebookViewProps) => {
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
    <div className="w-[1920px] h-[1080px] border">
      <Header hasNotifications />
      <ResourceBar
        title="Notebook #12345"
        titleDot="#D95BA7"
        tags={[{ name: 'Notebook', color: '#CA922E' }]}
        buttonPrimary="pause"
        buttonSecondary="enter"
        host
        path="root/app/project_weather/notebook2.ipynb"
        warningColor="blue"
      />
      <div className="flex justify-between pl-[20px] pt-[7px]">
        <div className="flex items-center gap-[9px]">
          <span className="text-[9px] text-white/80">Accesses</span>
          <div className="h-1 w-1 rounded-full bg-white/20" />
          <span className="text-[9px] text-white/80">
            Server:Antoine Durand
          </span>
          <div className="h-1 w-1 rounded-full bg-white/20" />
          <span className="text-[9px] text-white/80">
            Volume:volume_datascience_238
          </span>
          <div className="h-1 w-1 rounded-full bg-white/20" />
          <span className="text-[9px] text-white/80">
            Notebook:Notebook #12345
          </span>
          <div className="h-1 w-1 rounded-full bg-white/20" />
        </div>

        <div className="mr-10 cursor-pointer z-20">
          <icons.Close className="cursor-pointer h-[40px] w-[40px]" />
        </div>
      </div>
      <div className="h-[calc(1080px-90px)] relative pt-[20px] flex gap-[30px]">
        <Sidebar active={'tree'} items={menuItems} />

        <div className="w-full">
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
          <section className="pt-[10px] !w-full pr-[50px] grid grid-cols-12 gap-[100px]">
            <div className="col-span-4">
              <ResourceDescription editing={updateDescription} />
            </div>
            <div className="col-span-4 flex flex-col gap-5">
              <div className="relative group">
                <SelectFieldset
                  name={''}
                  value={'Python 3.10.12 modele'}
                  onChange={function (v: string): void {}}
                  placeholder={''}
                  style={{
                    background: '#2A2A3F',
                    height: '55px',
                    boxShadow: 'none',
                    borderRadius: '0.5rem',
                  }}
                >
                  {[
                    'Python 3.10.11 modele',
                    'Python 3.10.12 modele',
                    'Python 3.10.13 modele',
                    'Python 3.10.14 modele',
                  ].map((v) => (
                    <SelectItem value={v}>{v}</SelectItem>
                  ))}
                </SelectFieldset>
              </div>

              <div className="flex items-center gap-5">
                <div className="relative group w-full">
                  <SelectFieldset
                    name="instanceType"
                    value={awsInstanceTypes[0].Instance}
                    onChange={(s) => null}
                    placeholder="Select an instance type…"
                    integrated
                    style={{
                      background: '#2A2A3F',
                      height: '47px',
                      boxShadow: 'none',
                      borderRadius: '0.5rem',
                      width: '100%',
                      padding: '0 var(--form-input-padding-x)',
                    }}
                  >
                    {awsInstanceTypes.map((type) => (
                      <SelectItem key={type.Instance} value={type.Instance}>
                        <b>{type.Instance}</b> (vCPUs <b>{type.vCPU}</b> Memory{' '}
                        <b>{type.Memory_GiB}</b> GiB)
                      </SelectItem>
                    ))}
                  </SelectFieldset>
                </div>
                <div className="w-[120px] h-[47px] rounded-lg border-white/40 border flex items-center justify-center">
                  <span className="text-[12px] text-white font-bold leading-[28px]">
                    2048 MB
                  </span>
                </div>
              </div>

              <div className="border border-[#9542C6] py-[8px] px-[28px] flex flex-col gap-[14px]">
                <div className="flex flex-col gap-2">
                  <p className="text-white font-bold text-[12px] leading-[28px]">
                    volume_datascience_238
                  </p>
                  <div className="flex items-center justify-between">
                    <div className="text-[12px] text-center text-white font-bold rounded-[4px] h-[18px] min-w-[36px] bg-[#BA783A]">
                      aws
                    </div>
                    <span className="leading-[28px] font-bold text-white text-[12px]">
                      753 mo
                    </span>
                  </div>
                </div>
                <span className="text-white text-[12px] leading-[28px]">
                  root/app/project_weather/notebook2.ipynb
                </span>
              </div>
            </div>
            <div className="col-span-4">
              <SummaryAccesses activeTab="users" />
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
      className={`uppercase bg-[#252546] rounded-[4px] px-2 py-1 text-[10px] font-medium leading-[14px] min-h-[22px] h-[22px] flex items-center w-fit`}
      style={{ color: color }}
      contentEditable={true}
    >
      {text}
    </span>
  );
};
