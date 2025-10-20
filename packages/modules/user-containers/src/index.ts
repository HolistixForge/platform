import { ServersReducer } from './lib/servers-reducer';
import { ContainerImageRegistry } from './lib/image-registry';
import type { TModule } from '@monorepo/module';
import type { TCollabBackendExports } from '@monorepo/collab';
import type { TReducersBackendExports } from '@monorepo/reducers';
import type { TGatewayExports } from '@monorepo/gateway';
import type { TServersSharedData } from './lib/servers-shared-model';
import type { TCoreSharedData } from '@monorepo/core-graph';

export type TUserContainersExports = {
  imageRegistry: ContainerImageRegistry;
  containerImages: any[];
};

type TRequired = {
  collab: TCollabBackendExports<TServersSharedData & TCoreSharedData>;
  reducers: TReducersBackendExports;
  gateway: TGatewayExports;
};

const containerImagesData = [
  {
    imageId: 'pgadmin:latest',
    imageName: 'pgAdmin 4',
    imageUri: 'public.ecr.aws/f3g9x7j4/demiurge-pgadmin4',
    imageTag: 'latest',
    userAvailable: true,
    description: 'Web-based PostgreSQL administration tool',
    category: 'database',
    options: {
      containerType: 'pgadmin',
      ports: [8888],
      oauthClients: [
        {
          serviceName: 'pgadmin4',
          accessTokenLifetime: 31536000,
          redirectUris: [
            'https://CONTAINER_SLUG.containers.yourdomain.com/oauth2/authorize',
          ],
        },
      ],
    },
  },
  {
    imageId: 'ubuntu:24.04',
    imageName: 'Ubuntu 24.04',
    imageUri: 'public.ecr.aws/f3g9x7j4/ubuntu',
    imageTag: '24.04',
    userAvailable: true,
    description: 'Generic Ubuntu container for custom applications',
    category: 'system',
    options: {
      containerType: 'generic',
      ports: [8888],
    },
  },
  {
    imageId: 'n8n:latest',
    imageName: 'n8n Workflow Automation',
    imageUri: 'public.ecr.aws/f3g9x7j4/n8n',
    imageTag: '1.97.1',
    imageSha256:
      'ff133f8dd904270c7d15460a563103395dcf04eaafce0823455231832fd48d0e',
    userAvailable: true,
    description: 'Workflow automation platform',
    category: 'automation',
    options: {
      containerType: 'n8n',
      ports: [8888],
      oauthClients: [
        {
          serviceName: 'n8n',
          accessTokenLifetime: 31536000,
          redirectUris: [
            'https://CONTAINER_SLUG.containers.yourdomain.com/oauth_callback',
          ],
        },
      ],
    },
  },
];

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
    depsExports.collab.collab.loadSharedData(
      'array',
      'user-containers',
      'images'
    );

    // Setup image registry
    const registry = new ContainerImageRegistry();
    registry.register(containerImagesData);

    // Get shared data to populate container images
    // Note: This is a simplified version without the full loadExtraContext logic
    // The full logic would need to be adapted based on how modules are now loaded

    // Load reducers
    depsExports.reducers.loadReducers(new ServersReducer());

    // Export registry and images
    moduleExports({
      imageRegistry: registry,
      containerImages: containerImagesData,
    });
  },
};

export type { TServersSharedData } from './lib/servers-shared-model';

export { projectServerNodeId } from './lib/servers-reducer';

export type {
  TContainerImageDefinition,
  TOAuthClient,
  TContainerImageInfo,
  TContainerImageOptions,
} from './lib/container-image';

export type {
  TServer,
  TServerComponentProps,
  TServerComponentCallbacks,
} from './lib/servers-types';
export {
  TServer_to_TServerComponentProps as TSSS_Server_to_TServerComponentProps,
  serviceUrl,
} from './lib/servers-types';

export type {
  TServerEvents,
  TEventNewServer,
  TEventDeleteServer,
} from './lib/servers-events';
