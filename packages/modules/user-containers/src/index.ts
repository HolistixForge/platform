import { UserContainersReducer } from './lib/servers-reducer';
import { ContainerImageRegistry } from './lib/image-registry';
import type { TModule } from '@holistix-forge/module';
import type { TCollabBackendExports } from '@holistix-forge/collab';
import type { TReducersBackendExports } from '@holistix-forge/reducers';
import type { TGatewayExports } from '@holistix-forge/gateway';
import type { TContainerImageDefinition } from './lib/container-image';
import type { ContainerRunner } from './lib/runner';
import { localRunnerBackend } from './lib/local-runner';
import { PlatformRunnerBackend } from './lib/platform-runner';
import { log, EPriority } from '@holistix-forge/log';
import { setPlacementProvider } from './lib/placement-provider';

//

export type TUserContainersExports = {
  imageRegistry: ContainerImageRegistry;
  registerContainerRunner: (
    id: string,
    containerRunner: ContainerRunner
  ) => void;
  getRunner: (id: string) => ContainerRunner | undefined;
  listRunnerIds: () => string[];
};

// Broker configuration arrives through `gateway.environment`, never through
// `process.env`. Module packages are bundled with a browser `process` shim, so
// reading the environment here yields an empty object and the platform runner
// silently never registers — which is exactly what happened the first time this
// was deployed.

type TRequired = {
  collab: TCollabBackendExports;
  reducers: TReducersBackendExports;
  gateway: TGatewayExports;
};

export const moduleBackend: TModule<TRequired, TUserContainersExports> = {
  name: 'user-containers',
  version: '0.0.1',
  description: 'User containers module',
  dependencies: ['core-graph', 'collab', 'reducers', 'gateway'],
  load: ({ depsExports, moduleExports }) => {
    // Register permissions with PermissionRegistry
    const permissionRegistry = depsExports.gateway.permissionRegistry;

    // Simple permissions
    permissionRegistry.register('user-containers:[user-container:*]:create', {
      resourcePath: 'user-container:*',
      action: 'create',
      description: 'Create user containers',
    });
    permissionRegistry.register('user-containers:[user-container:*]:delete', {
      resourcePath: 'user-container:*',
      action: 'delete',
      description: 'Delete user containers',
    });
    permissionRegistry.register('user-containers:[user-container:*]:host', {
      resourcePath: 'user-container:*',
      action: 'host',
      description: 'Host user containers',
    });
    permissionRegistry.register('user-containers:[user-container:*]:terminal', {
      resourcePath: 'user-container:*',
      action: 'terminal',
      description: 'Open interactive terminals in user containers',
    });

    // Load shared data
    depsExports.collab.registry.registerSharedData(
      'map',
      'user-containers',
      'containers'
    );
    depsExports.collab.registry.registerSharedData(
      'map',
      'user-containers',
      'images'
    );
    depsExports.collab.registry.registerSharedData(
      'map',
      'user-containers',
      'runners'
    );
    depsExports.collab.registry.registerSharedData(
      'map',
      'user-containers',
      'machines'
    );

    const registry = new ContainerImageRegistry();

    // Register built-in images owned by user-containers module itself.
    // These do not depend on other feature modules.
    const builtinImages: TContainerImageDefinition[] = [
      {
        imageId: 'ubuntu:terminal',
        imageName: 'Ubuntu Terminal',
        imageUri: 'holistixforge/ubuntu-terminal',
        imageTag: '24.04',
        description:
          'Minimal Ubuntu 24.04 container exposing only a web-based terminal',
        category: 'utility',
      },
    ];
    registry.register(builtinImages);

    const containerRunners: Map<string, ContainerRunner> = new Map();

    const registerContainerRunner: (
      id: string,
      containerRunner: ContainerRunner
    ) => void = (id, containerRunner) => {
      containerRunners.set(id, containerRunner);
    };

    registerContainerRunner('local', localRunnerBackend);

    const broker = depsExports.gateway.environment?.containerBroker;
    if (broker) {
      registerContainerRunner(
        'platform',
        new PlatformRunnerBackend({
          endpoint: broker.endpoint,
          token: broker.token,
        })
      );
      log(
        EPriority.Info,
        'USER_CONTAINERS',
        `Platform runner registered (broker: ${broker.endpoint})`
      );
    } else {
      log(
        EPriority.Info,
        'USER_CONTAINERS',
        'No container broker configured; local runner only'
      );
    }

    // Export registry and images
    moduleExports({
      imageRegistry: registry,
      registerContainerRunner,
      getRunner: (id: string) => containerRunners.get(id),
      listRunnerIds: () => Array.from(containerRunners.keys()),
    });

    // Load reducers
    const userContainersReducer = new UserContainersReducer(
      depsExports as TRequired & { 'user-containers': TUserContainersExports }
    );
    depsExports.reducers.loadReducers(userContainersReducer);

    // The gateway's /placements route asks the reducer, because everything a
    // runner needs beyond a name — the resolved image, the SETTINGS blob, the
    // hosting token that doubles as the container's VPN password — is held on
    // the gateway and deliberately kept out of the collab document.
    setPlacementProvider((project_id, machine_id) =>
      userContainersReducer.placementsFor(project_id, machine_id)
    );
  },
};

export type { TUserContainersSharedData } from './lib/servers-shared-model';

export { userContainerNodeId } from './lib/servers-reducer';

export type {
  TContainerImageDefinition,
  TContainerImageInfo,
} from './lib/container-image';

export type { TUserContainer } from './lib/servers-types';
export { serviceUrl } from './lib/servers-types';

export type {
  TUserContainersEvents,
  TEventNew,
  TEventDelete,
} from './lib/servers-events';

export { getPlacementProvider } from './lib/placement-provider';
export type { TRunnerPlacement } from './lib/placement-shape';
