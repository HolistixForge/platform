import { useState } from 'react';

import { ResourceBar, ServerStack } from '@holistix-forge/ui-views';
import {
  TUserContainer,
  TUserContainersSharedData,
} from '@holistix-forge/user-containers';
import {
  NewContainerForm,
  ServerCard,
} from '@holistix-forge/user-containers/frontend';
import { useLocalSharedData } from '@holistix-forge/collab/frontend';

import { useProject } from '@holistix-forge/frontend-data';

//

export const ResourcePage = () => {
  const userContainers: Map<string, TUserContainer> =
    useLocalSharedData<TUserContainersSharedData>(
      ['user-containers:containers'],
      (sd) => sd['user-containers:containers']
    );

  const project = useProject();

  const [displayNewServerForm, setDisplayNewServerForm] = useState(false);

  const containerIds: string[] = [];

  userContainers.forEach((c) => containerIds.push(c.user_container_id));

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
        <div style={{ padding: '96px' }}>
          <ServerStack onNewServerClick={() => setDisplayNewServerForm(true)}>
            {containerIds.map((ucid) => (
              <ServerCard key={ucid} container_id={ucid} />
            ))}
          </ServerStack>
        </div>
      </div>

      {displayNewServerForm && (
        <NewContainerForm
          projectId={project.project.project_id}
          closeForm={() => setDisplayNewServerForm(false)}
        />
      )}
    </>
  );
};
