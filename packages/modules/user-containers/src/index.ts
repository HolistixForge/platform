import { Servers_loadData } from './lib/servers-shared-model';
import { ServersReducer } from './lib/servers-reducer';
import { ContainerImageRegistry } from './lib/image-registry';
import type { ModuleBackend } from '@monorepo/module';

export type TUserContainersExtraContext = {
  userContainers: {
    imageRegistry: ContainerImageRegistry;
  };
};

export const moduleBackend: ModuleBackend = {
  collabChunk: {
    name: 'user-containers',
    loadSharedData: Servers_loadData,
    loadReducers: (sd) => [new ServersReducer()],
    deps: [
      'gateway', // updateReverseProxy, gatewayFQDN, toGanymede, ...
    ],
    loadExtraContext: ({
      sharedData,
      extraContext,
    }): TUserContainersExtraContext => {
      const registry = new ContainerImageRegistry();

      // Register images from all modules
      const modules = (extraContext as any).modules || [];
      modules.forEach((module: any) => {
        if (module.containerImages) {
          registry.register(module.containerImages);
        }
      });

      // Populate shared data with simplified image info for frontend
      if (sharedData.containerImages) {
        const allImages = registry.list({ userAvailable: true });
        const simplifiedImages = allImages.map((img) => ({
          imageId: img.imageId,
          imageName: img.imageName,
          description: img.description,
        }));

        // Clear and populate the shared array
        const containerImages = sharedData.containerImages as any;
        containerImages.delete(0, containerImages.length);
        simplifiedImages.forEach((img) => containerImages.push([img]));
      }

      return {
        userContainers: {
          imageRegistry: registry,
        },
      };
    },
  },
  containerImages: [
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
  ],
};

export type { TServersSharedData } from './lib/servers-shared-model';

export { projectServerNodeId } from './lib/servers-reducer';

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
