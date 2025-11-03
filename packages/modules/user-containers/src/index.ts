import { UserContainersReducer } from './lib/servers-reducer';
import { ContainerImageRegistry } from './lib/image-registry';
import type { TModule } from '@monorepo/module';
import type { TCollabBackendExports } from '@monorepo/collab';
import type { TReducersBackendExports } from '@monorepo/reducers';
import type { TGatewayExports } from '@monorepo/gateway';
import type { TUserContainersSharedData } from './lib/servers-shared-model';
import type { TCoreSharedData } from '@monorepo/core-graph';
import type { TContainerImageInfo } from './lib/container-image';
import type { ContainerRunner } from './lib/runner';
import { localRunnerBackend } from './lib/local-runner';

//

export type TUserContainersExports = {
  imageRegistry: ContainerImageRegistry;
  registerContainerRunner: (
    id: string,
    containerRunner: ContainerRunner
  ) => void;
};

type TRequired = {
  collab: TCollabBackendExports<TUserContainersSharedData & TCoreSharedData>;
  reducers: TReducersBackendExports;
  gateway: TGatewayExports;
};

export const moduleBackend: TModule<TRequired, TUserContainersExports> = {
  name: 'user-containers',
  version: '0.0.1',
  description: 'User containers module',
  dependencies: ['core-graph', 'collab', 'reducers', 'gateway'],
  load: ({ depsExports, moduleExports }) => {
    // Load shared data
    depsExports.collab.collab.loadSharedData(
      'map',
      'user-containers',
      'containers'
    );

    const iamgesSharedArray =
      depsExports.collab.collab.loadSharedData<TContainerImageInfo>(
        'map',
        'user-containers',
        'images'
      );

    // Setup image registry
    const registry = new ContainerImageRegistry(iamgesSharedArray);

    const containerRunners: Map<string, ContainerRunner> = new Map();

    const registerContainerRunner: (
      id: string,
      containerRunner: ContainerRunner
    ) => void = (id, containerRunner) => {
      containerRunners.set(id, containerRunner);
    };

    registerContainerRunner('local', localRunnerBackend);

    // Export registry and images
    moduleExports({
      imageRegistry: registry,
      registerContainerRunner,
    });

    // Load reducers
    depsExports.reducers.loadReducers(
      new UserContainersReducer(
        depsExports as TRequired & { 'user-containers': TUserContainersExports }
      )
    );
  },
};

export type { TUserContainersSharedData as TServersSharedData } from './lib/servers-shared-model';

export { userContainerNodeId as projectServerNodeId } from './lib/servers-reducer';

export type {
  TContainerImageDefinition,
  TOAuthClient,
  TContainerImageInfo,
} from './lib/container-image';

export type { TUserContainer } from './lib/servers-types';
export { serviceUrl } from './lib/servers-types';

export type {
  TUserContainersEvents as TServerEvents,
  TEventNew,
  TEventDelete,
} from './lib/servers-events';
