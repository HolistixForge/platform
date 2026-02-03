import { UserContainersReducer } from './lib/servers-reducer';
import { ContainerImageRegistry } from './lib/image-registry';
import type { TModule } from '@holistix-forge/module';
import type { TCollabBackendExports } from '@holistix-forge/collab';
import type { TReducersBackendExports } from '@holistix-forge/reducers';
import type { TGatewayExports } from '@holistix-forge/gateway';
import type { TContainerImageDefinition } from './lib/container-image';
import type { ContainerRunner } from './lib/runner';
import { localRunnerBackend } from './lib/local-runner';
import { TUserContainer } from './lib/servers-types';
import { SharedMap } from '@holistix-forge/collab-engine';

//

export type TUserContainersExports = {
  imageRegistry: ContainerImageRegistry;
  registerContainerRunner: (
    id: string,
    containerRunner: ContainerRunner
  ) => void;
  getRunner: (id: string) => ContainerRunner | undefined;
};

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
        oauthClients: [],
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

    // Register generic protected service(s) with gateway
    // Example: user-container terminal resolver
    const protectedServiceRegistry =
      depsExports.gateway.protectedServiceRegistry;
    protectedServiceRegistry.registerService({
      id: 'user-containers:terminal',
      checkPermission: async (ctx, { permissionManager }) => {
        if (!ctx.userId) return false;
        const containerId =
          (ctx.query.user_container_id as string) ||
          (ctx.query.userContainerId as string);
        if (!containerId) return false;
        // permission format: user-containers:[user-container:{id}]:terminal
        const permission = `user-containers:[user-container:${containerId}]:terminal`;
        return permissionManager.hasPermission(ctx.userId, permission);
      },
      resolve: async (ctx) => {
        const containerId =
          (ctx.query.user_container_id as string) ||
          (ctx.query.userContainerId as string);
        if (!containerId) {
          return null;
        }

        // Get project-specific collab instance
        // TODO: Ensure ctx has project_id from request context
        const project_id =
          (ctx.query.project_id as string) || 'default-project';
        const collab =
          depsExports.collab.registry.getCollabForProject(project_id);

        // Access shared data through collab engine
        const sduc = collab.sharedData[
          'user-containers:containers'
        ] as SharedMap<TUserContainer>;
        const container = sduc.get(containerId);
        if (!container) {
          return null;
        }

        // Find a httpService named "terminal"
        const terminalService = container.httpServices.find(
          (s: { name: string }) => s.name === 'terminal'
        );
        if (!terminalService) {
          return null;
        }

        // For now, return high-level metadata. Consumers decide how to use it.
        return {
          data: {
            user_container_id: container.user_container_id,
            service: 'terminal',
            host: terminalService.host,
            port: terminalService.port,
            secure: terminalService.secure ?? true,
          },
        };
      },
    });

    // Export registry and images
    moduleExports({
      imageRegistry: registry,
      registerContainerRunner,
      getRunner: (id: string) => containerRunners.get(id),
    });

    // Load reducers
    depsExports.reducers.loadReducers(
      new UserContainersReducer(
        depsExports as TRequired & { 'user-containers': TUserContainersExports }
      )
    );
  },
};

export type { TUserContainersSharedData } from './lib/servers-shared-model';

export { userContainerNodeId } from './lib/servers-reducer';

export type {
  TContainerImageDefinition,
  TOAuthClient,
  TContainerImageInfo,
} from './lib/container-image';

export type { TUserContainer } from './lib/servers-types';
export { serviceUrl } from './lib/servers-types';

export type {
  TUserContainersEvents,
  TEventNew,
  TEventDelete,
} from './lib/servers-events';
