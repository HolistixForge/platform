import './lib/index.scss';
import { NodeServer } from './lib/components/node-server/node-server';
import type { TModule } from '@holistix/module';
import type { TCollabFrontendExports } from '@holistix/collab/frontend';
import type { TSpaceFrontendExports } from '@holistix/space/frontend';
import { serversMenuEntries } from './lib/servers-menu';
import { localRunnerFrontend } from './lib/local-runner-frontend';
import { TUserContainersSharedData } from './lib/servers-shared-model';
import { TUserContainer } from './lib/servers-types';

//

export type TContainerRunnerFrontend = {
  icon: React.FC;
  label: string;
  UI: React.FC;
};

export type TUserContainersFrontendExports = {
  getToken: (
    userContainer: TUserContainer,
    serviceName: string
  ) => Promise<string>;
  registerContainerRunner: (
    id: string,
    containerRunner: TContainerRunnerFrontend
  ) => void;
  getRunners: () => Map<string, TContainerRunnerFrontend>;
};

type TRequired = {
  collab: TCollabFrontendExports<TUserContainersSharedData>;
  space: TSpaceFrontendExports;
};

export const moduleFrontend: TModule<TRequired> = {
  name: 'user-containers',
  version: '0.0.1',
  description: 'User containers module',
  dependencies: ['core-graph', 'collab', 'space', 'tabs'],
  load: ({ depsExports, moduleExports }) => {
    depsExports.collab.collab.loadSharedData(
      'map',
      'user-containers',
      'containers'
    );
    depsExports.collab.collab.loadSharedData(
      'map',
      'user-containers',
      'images'
    );

    depsExports.space.registerMenuEntries(serversMenuEntries);
    depsExports.space.registerNodes({
      'user-container': NodeServer,
    });

    const containerRunners: Map<string, TContainerRunnerFrontend> = new Map();

    const registerContainerRunner: (
      id: string,
      containerRunner: TContainerRunnerFrontend
    ) => void = (id, containerRunner) => {
      containerRunners.set(id, containerRunner);
    };

    registerContainerRunner('local', localRunnerFrontend);

    const exports: TUserContainersFrontendExports = {
      getToken: async (userContainer, serviceName) => {
        const service = userContainer.httpServices.find(
          (s) => s.name === serviceName
        );
        if (!service) {
          throw new Error(`Service ${serviceName} not found`);
        }
        throw new Error('Not implemented');
      },
      registerContainerRunner,
      getRunners: () => containerRunners,
    };

    moduleExports(exports);
  },
};

export { StatusLed } from './lib/components/status-led';
export { UserContainerCardInternal } from './lib/components/server-card';
export { NewContainerForm } from './lib/form/new-server';
