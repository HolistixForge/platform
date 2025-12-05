import { useState } from 'react';

import { ResourceBar, ServerStack } from '@holistix-forge/ui-views';
import {
  TUserContainer,
  TUserContainersSharedData,
} from '@holistix-forge/user-containers';
import {
  NewContainerForm,
  TContainerRunnerFrontend,
  UserContainerCardInternal,
} from '@holistix-forge/user-containers/frontend';
import { useLocalSharedData } from '@holistix-forge/collab/frontend';

import { ProjectSidebar } from '../sidebar';
import { useProject } from '../project-context';

//

export const ResourcePage = () => {
  const userContainers: Map<string, TUserContainer> =
    useLocalSharedData<TUserContainersSharedData>(
      ['user-containers:containers'],
      (sd) => sd['user-containers:containers']
    );

  const project = useProject();

  const [displayNewServerForm, setDisplayNewServerForm] = useState(false);

  const array: string[] = [];

  userContainers.forEach((p) => array.push(p.user_container_id));

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
            {array.map((ucid) => (
              <UserContainerCardInternal
                container={userContainers.get(ucid) as TUserContainer}
                image={undefined}
                onDelete={function (): Promise<void> {
                  throw new Error('Function not implemented.');
                }}
                onOpenService={function (name: string): void {
                  throw new Error('Function not implemented.');
                }}
                onSelectRunner={function (runner_id: string): Promise<void> {
                  throw new Error('Function not implemented.');
                }}
                runners={new Map<string, TContainerRunnerFrontend>()}
              />
            ))}
          </ServerStack>
        </div>{' '}
      </div>
      <ProjectSidebar active="project-main" />

      {displayNewServerForm && (
        <NewContainerForm
          projectId={project.project.project_id}
          closeForm={() => setDisplayNewServerForm(false)}
        />
      )}
    </>
  );
};
