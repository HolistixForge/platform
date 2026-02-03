import { useState } from 'react';

import {
  Sidebar,
  icons,
  SelectFieldset,
  SelectItem,
} from '@holistix-forge/ui-base';

import { Header } from '../components/header';
import { ResourceBar } from '../components/resource-bar';
import { ResourceDescription } from '../components/resource-description';
import { SummaryAccesses } from '../components/summary-accesses';
import { menuItems } from './access-role';

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
    <div style={{ width: '1920px', height: '1080px', border: '1px solid' }}>
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
            Server:Antoine Durand
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
            Volume:volume_datascience_238
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
            Notebook:Notebook #12345
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
        <Sidebar active={'tree'} items={menuItems} />

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
              gap: '100px',
            }}
          >
            <div style={{ gridColumn: 'span 4' }}>
              <ResourceDescription editing={updateDescription} />
            </div>
            <div
              className="flex flex-col"
              style={{ gridColumn: 'span 4', gap: '20px' }}
            >
              <div className="relative">
                <SelectFieldset
                  name={''}
                  value={'Python 3.10.12 modele'}
                  onChange={function (v: string): void {
                    /* noop */
                  }}
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

              <div className="flex items-center" style={{ gap: '20px' }}>
                <div className="relative w-full">
                  <SelectFieldset
                    name="instanceType"
                    value={''}
                    onChange={(s) => null}
                    placeholder="Select an instance type..."
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
                    {[{ Instance: 't3.micro', vCPU: 2, Memory_GiB: 1 }].map(
                      (type) => (
                        <SelectItem key={type.Instance} value={type.Instance}>
                          <b>{type.Instance}</b> (vCPUs <b>{type.vCPU}</b>{' '}
                          Memory <b>{type.Memory_GiB}</b> GiB)
                        </SelectItem>
                      )
                    )}
                  </SelectFieldset>
                </div>
                <div
                  className="flex items-center justify-center"
                  style={{
                    width: '120px',
                    height: '47px',
                    borderRadius: '8px',
                    border: '1px solid rgba(255,255,255,0.4)',
                  }}
                >
                  <span
                    className="font-bold"
                    style={{
                      fontSize: '12px',
                      color: 'white',
                      lineHeight: '28px',
                    }}
                  >
                    2048 MB
                  </span>
                </div>
              </div>

              <div
                className="flex flex-col"
                style={{
                  border: '1px solid #9542C6',
                  padding: '8px 28px',
                  gap: '14px',
                }}
              >
                <div className="flex flex-col" style={{ gap: '8px' }}>
                  <p
                    className="font-bold"
                    style={{
                      color: 'white',
                      fontSize: '12px',
                      lineHeight: '28px',
                    }}
                  >
                    volume_datascience_238
                  </p>
                  <div className="flex items-center justify-between">
                    <div
                      className="font-bold text-center"
                      style={{
                        fontSize: '12px',
                        color: 'white',
                        borderRadius: '4px',
                        height: '18px',
                        minWidth: '36px',
                        backgroundColor: '#BA783A',
                      }}
                    >
                      aws
                    </div>
                    <span
                      className="font-bold"
                      style={{
                        lineHeight: '28px',
                        color: 'white',
                        fontSize: '12px',
                      }}
                    >
                      753 mo
                    </span>
                  </div>
                </div>
                <span
                  style={{
                    color: 'white',
                    fontSize: '12px',
                    lineHeight: '28px',
                  }}
                >
                  root/app/project_weather/notebook2.ipynb
                </span>
              </div>
            </div>
            <div style={{ gridColumn: 'span 4' }}>
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
