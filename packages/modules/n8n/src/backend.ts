import type { TModule } from '@holistix/module';
import type { TUserContainersExports } from '@holistix/user-containers';

const containerImagesData = [
  {
    imageId: 'n8n:latest',
    imageName: 'n8n Workflow Automation',
    imageUri: 'demiurge/n8n',
    imageTag: '1.97.1',
    description: 'n8n workflow automation platform',
    category: 'automation',
    oauthClients: [
      {
        serviceName: 'n8n',
        accessTokenLifetime: 31536000,
        redirectUris: [],
      },
    ],
  },
];

type TRequired = {
  'user-containers': TUserContainersExports;
};

export const moduleBackend: TModule<TRequired> = {
  name: 'n8n',
  version: '0.0.1',
  description: 'n8n workflow automation module',
  dependencies: ['user-containers'],
  load: ({ depsExports }) => {
    depsExports['user-containers'].imageRegistry.register(containerImagesData);
  },
};

