import { useState } from 'react';

import { ResourceBar, ServerStack } from '@monorepo/ui-views';
import { ServerCard } from '@monorepo/servers/frontend';
import { TServer } from '@monorepo/servers';
import { NewServerForm } from '@monorepo/servers/frontend';

import { ProjectSidebar } from '../sidebar';
import { useSharedData } from '../model/collab-model-chunk';

//

export const ResourcePage = () => {
  const projectServers: Map<string, TServer> = useSharedData(
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
          maxHeight: 'calc(100vh - 76px)',
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
