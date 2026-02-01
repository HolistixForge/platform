import { useEffect, useState } from 'react';

import { icons, randomGuy } from '@holistix-forge/ui-base';

import { Tabs } from './tabs';
import { UserDisplayItem } from '../assets/user-display-item';
import { Wrapper } from '../assets/wrapper';

//

type SummaryAccessesProps = {
  activeTab: 'users' | 'groups' | 'roles';
};

export const SummaryAccesses = ({ activeTab }: SummaryAccessesProps) => {
  const [_activeTab, _setActiveTab] = useState<'users' | 'groups' | 'roles'>(
    'users'
  );

  const [inAdmin, setInAdmin] = useState<any[]>([]);
  const [inWriter, setInWriter] = useState<any[]>([]);
  const [inReader, setInReader] = useState<any[]>([]);

  useEffect(() => {
    _setActiveTab(activeTab);
  }, [activeTab]);

  return (
    <div className="flex flex-col w-full" style={{ gap: '10px' }}>
      <div className="flex items-center" style={{ gap: '14px' }}>
        <icons.SummaryAccess />
        <Tabs
          currentTabs={activeTab}
          tabs={[
            {
              tab: 'Users',
              action: () => _setActiveTab('users'),
            },
            {
              tab: 'Groups',
              action: () => _setActiveTab('groups'),
            },
            {
              tab: 'Roles',
              action: () => _setActiveTab('roles'),
            },
          ]}
        />
      </div>
      <div className="flex flex-col" style={{ gap: '18px' }}>
        <div
          className="flex flex-col"
          style={{ minWidth: '300px', gap: '10px' }}
        >
          <div
            className="cursor-pointer flex items-center justify-between"
            style={{
              transition: 'all 0.2s',
              backgroundColor: '#2A2A3F',
              height: '30px',
              borderRadius: '4px',
              padding: '0 14px',
              fontSize: '12px',
            }}
            onClick={() => setInAdmin((prevState) => [...prevState, 'test'])}
          >
            Admin
            <span>+</span>
          </div>

          {_activeTab === 'users' ? (
            <div
              style={{
                padding: '0 8px',
                display: 'flex',
                flexDirection: 'column',
                gap: '8px',
              }}
            >
              {inAdmin.map((user, index) => (
                <UserDisplayItem
                  key={index}
                  user={randomGuy()}
                  role="role"
                  roleColor="#bf8e2d"
                  buttons={{
                    remove: true,
                  }}
                />
              ))}
            </div>
          ) : _activeTab === 'groups' ? (
            <div
              style={{
                padding: '0 8px',
                display: 'flex',
                flexDirection: 'column',
                gap: '40px',
                marginTop: inAdmin.length > 0 ? '40px' : undefined,
              }}
            >
              {inAdmin.map((user, index) => (
                <Wrapper
                  resizeBorderColor="red"
                  tag="team sync_13"
                  tagColor="#39b139"
                  displayRemove
                  user={randomGuy()}
                />
              ))}
            </div>
          ) : (
            <div
              style={{
                padding: '0 8px',
                display: 'flex',
                flexDirection: 'column',
                gap: '40px',
                marginTop: inAdmin.length > 0 ? '40px' : undefined,
              }}
            >
              {inAdmin.map((user, index) => (
                <Wrapper
                  resizeBorderColor="red"
                  tag="team sync_13"
                  tagColor="#39b139"
                  displayRemove
                />
              ))}
            </div>
          )}

          <div
            className="cursor-pointer flex items-center justify-between"
            style={{
              transition: 'all 0.2s',
              backgroundColor: '#2A2A3F',
              height: '30px',
              borderRadius: '4px',
              padding: '0 14px',
              fontSize: '12px',
            }}
            onClick={() => setInWriter((prevState) => [...prevState, 'test'])}
          >
            Writer
            <span>+</span>
          </div>

          {_activeTab === 'users' ? (
            <div
              style={{
                padding: '0 8px',
                display: 'flex',
                flexDirection: 'column',
                gap: '8px',
              }}
            >
              {inWriter.map((user, index) => (
                <UserDisplayItem
                  key={index}
                  user={randomGuy()}
                  role="role"
                  roleColor="#bf8e2d"
                  buttons={{
                    remove: true,
                  }}
                />
              ))}
            </div>
          ) : _activeTab === 'groups' ? (
            <div
              style={{
                padding: '0 8px',
                display: 'flex',
                flexDirection: 'column',
                gap: '40px',
                marginTop: inWriter.length > 0 ? '40px' : undefined,
              }}
            >
              {inWriter.map((user, index) => (
                <Wrapper
                  resizeBorderColor="red"
                  tag="team sync_13"
                  tagColor="#39b139"
                  displayRemove
                  user={randomGuy()}
                />
              ))}
            </div>
          ) : (
            <div
              style={{
                padding: '0 8px',
                display: 'flex',
                flexDirection: 'column',
                gap: '40px',
                marginTop: inWriter.length > 0 ? '40px' : undefined,
              }}
            >
              {inWriter.map((user, index) => (
                <Wrapper
                  resizeBorderColor="red"
                  tag="team sync_13"
                  tagColor="#39b139"
                  displayRemove
                />
              ))}
            </div>
          )}

          <div
            className="cursor-pointer flex items-center justify-between"
            style={{
              transition: 'all 0.2s',
              backgroundColor: '#2A2A3F',
              height: '30px',
              borderRadius: '4px',
              padding: '0 14px',
              fontSize: '12px',
            }}
            onClick={() => setInReader((prevState) => [...prevState, 'test'])}
          >
            Reader
            <span>+</span>
          </div>

          {_activeTab === 'users' ? (
            <div
              style={{
                padding: '0 8px',
                display: 'flex',
                flexDirection: 'column',
                gap: '8px',
              }}
            >
              {inReader.map((user, index) => (
                <UserDisplayItem
                  key={index}
                  user={randomGuy()}
                  role="role"
                  roleColor="#bf8e2d"
                  buttons={{
                    remove: true,
                  }}
                />
              ))}
            </div>
          ) : _activeTab === 'groups' ? (
            <div
              style={{
                padding: '0 8px',
                display: 'flex',
                flexDirection: 'column',
                gap: '40px',
                marginTop: inReader.length > 0 ? '40px' : undefined,
              }}
            >
              {inReader.map((user, index) => (
                <Wrapper
                  resizeBorderColor="red"
                  tag="team sync_13"
                  tagColor="#39b139"
                  displayRemove
                  user={randomGuy()}
                />
              ))}
            </div>
          ) : (
            <div
              style={{
                padding: '0 8px',
                display: 'flex',
                flexDirection: 'column',
                gap: '40px',
                marginTop: inReader.length > 0 ? '40px' : undefined,
              }}
            >
              {inReader.map((user, index) => (
                <Wrapper
                  resizeBorderColor="red"
                  tag="team sync_13"
                  tagColor="#39b139"
                  displayRemove
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
