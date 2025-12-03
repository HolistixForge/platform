import { CSSProperties, useState } from 'react';

import { Sidebar, randomGuy } from '@holistix/ui-base';
import { ServerCardInternal } from '@holistix/user-containers/frontend';
import { TServerComponentProps } from '@holistix/user-containers';

import { Header } from '../components/header';
import { ResourceBar } from '../components/resource-bar';
import { ServerStack } from '../components/server-stack';
import { menuItems } from './access-role';

//

const makeFakeServer = (): TServerComponentProps => {
  const id = Math.floor(Math.random() * 100000);
  return {
    project_server_id: id,
    server_name: `server-${id}`,
    image: {
      image_id: 0,
      image_name: `image-${id}`,
      image_tag: `tag-${id}`,
      image_sha256: null,
    },
    httpServices: [
      {
        port: 8888,
        name: 'jupyterlab',
        location: `/${id}/jupyterlab`,
        host: 'localhost',
      },
    ],
    ip: `172.16.0.${Math.floor(Math.random() * 100)}`,
    last_watchdog_at: new Date(),
    last_activity: new Date(),
    host: randomGuy(),
    oauth: [],
    location: 'hosted',
    ec2_instance_state: null,
  };
};

//

export const ServersCreateView = () => {
  const [servers, setServers] = useState<TServerComponentProps[]>(
    Array(6)
      .fill(1)
      .map(() => makeFakeServer())
  );

  return (
    <div className="w-full">
      <Header hasNotifications />
      <ResourceBar buttonPrimary="" title="Server" />
      <div className="relative pt-[20px] flex gap-[30px] p-24">
        <Sidebar active={''} items={menuItems} />

        <section className="pt-[30px] w-full pr-[35px]">
          <ServerStack
            onNewServerClick={() => setServers([...servers, makeFakeServer()])}
          >
            {servers.map((s) => (
              <div
                style={
                  { '--node-wrapper-header-height': '-40px' } as CSSProperties
                }
              >
                <ServerCardInternal
                  onCloud={function (
                    InstanceType: string,
                    storage: number
                  ): Promise<void> {
                    throw new Error('Function not implemented.');
                  }}
                  onCloudStart={function (): Promise<void> {
                    throw new Error('Function not implemented.');
                  }}
                  onCloudStop={function (): Promise<void> {
                    throw new Error('Function not implemented.');
                  }}
                  onCloudDelete={function (): Promise<void> {
                    throw new Error('Function not implemented.');
                  }}
                  onHost={function (): Promise<void> {
                    throw new Error('Function not implemented.');
                  }}
                  onDelete={function (): Promise<void> {
                    throw new Error('Function not implemented.');
                  }}
                  {...s}
                />
              </div>
            ))}
          </ServerStack>
        </section>
      </div>
    </div>
  );
};
