import { useState } from 'react';

import { ResourceBar, ServerStack } from '@monorepo/ui-views';
import { ServerCard } from '@monorepo/user-containers/frontend';

import { TServer, TServersSharedData } from '@monorepo/user-containers';
import { NewServerForm } from '@monorepo/user-containers/frontend';
import { useSharedData } from '@monorepo/collab-engine';

import { ProjectSidebar } from '../sidebar';

//

export const ResourcePage = () => {
  const projectServers: Map<string, TServer> =
    useSharedData<TServersSharedData>(
      ['projectServers'],
      (sd) => sd.projectServers
    );

  const [displayNewServerForm, setDisplayNewServerForm] = useState(false);

  const array: number[] = [];

  projectServers.forEach((p) => array.push(p.project_server_id));

  return (
    <>
      <div
        style={{
          height: '100%',
          position: 'relative',
          maxHeight: 'calc(100dvh - 76px)',
          overflowY: 'auto',
        }}
      >
        <ResourceBar title="Resources" />
        <div className="p-24">
          <ServerStack onNewServerClick={() => setDisplayNewServerForm(true)}>
            {array.map((psid) => (
              <ServerCard project_server_id={psid} />
            ))}
          </ServerStack>
        </div>{' '}
      </div>
      <ProjectSidebar active="project-main" />

      {displayNewServerForm && (
        <NewServerForm closeForm={() => setDisplayNewServerForm(false)} />
      )}
    </>
  );
};
