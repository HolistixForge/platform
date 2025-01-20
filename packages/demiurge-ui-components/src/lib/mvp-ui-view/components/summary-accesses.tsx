import { icons } from '../../assets/icons';
import { useEffect, useState } from 'react';
import { Tabs } from './tabs';
import { UserDisplayItem } from '../assets/user-display-item';
import { Wrapper } from '../assets/wrapper';
import { randomGuy } from '../../utils/random-guys';

interface SummaryAccessesProps {
  activeTab: 'users' | 'groups' | 'roles';
}

export const SummaryAccesses = ({ activeTab }: SummaryAccessesProps) => {
  const [_activeTab, _setActiveTab] = useState<'users' | 'groups' | 'roles'>(
    'users',
  );

  const [inAdmin, setInAdmin] = useState<any[]>([]);
  const [inWriter, setInWriter] = useState<any[]>([]);
  const [inReader, setInReader] = useState<any[]>([]);

  useEffect(() => {
    _setActiveTab(activeTab);
  }, [activeTab]);

  return (
    <div className="flex flex-col gap-[10px] w-full">
      <div className="flex items-center gap-[14px]">
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
      <div className="flex flex-col gap-[18px]">
        <div className="flex flex-col min-w-[300px] gap-[10px]">
          <div
            className="cursor-pointer transition-all hover:bg-white/20 flex items-center justify-between bg-[#2A2A3F] h-[30px] rounded-[4px] px-[14px] text-[12px]"
            onClick={() => setInAdmin((prevState) => [...prevState, 'test'])}
          >
            Admin
            <span>+</span>
          </div>

          {_activeTab === 'users' ? (
            <div className="px-2 space-y-2">
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
            <div className={`px-2 space-y-10 ${inAdmin.length > 0 && 'mt-10'}`}>
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
            <div className={`px-2 space-y-10 ${inAdmin.length > 0 && 'mt-10'}`}>
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
            className="cursor-pointer transition-all hover:bg-white/20 flex items-center justify-between bg-[#2A2A3F] h-[30px] rounded-[4px] px-[14px] text-[12px]"
            onClick={() => setInWriter((prevState) => [...prevState, 'test'])}
          >
            Writer
            <span>+</span>
          </div>

          {_activeTab === 'users' ? (
            <div className="px-2 space-y-2">
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
              className={`px-2 space-y-10 ${inWriter.length > 0 && 'mt-10'}`}
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
              className={`px-2 space-y-10 ${inWriter.length > 0 && 'mt-10'}`}
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
            className="cursor-pointer transition-all hover:bg-white/20 flex items-center justify-between bg-[#2A2A3F] h-[30px] rounded-[4px] px-[14px] text-[12px]"
            onClick={() => setInReader((prevState) => [...prevState, 'test'])}
          >
            Reader
            <span>+</span>
          </div>

          {_activeTab === 'users' ? (
            <div className="px-2 space-y-2">
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
              className={`px-2 space-y-10 ${inReader.length > 0 && 'mt-10'}`}
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
              className={`px-2 space-y-10 ${inReader.length > 0 && 'mt-10'}`}
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
