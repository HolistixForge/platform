import type { TModule } from '@holistix-forge/module';
import type { TUserContainersExports } from '@holistix-forge/user-containers';

const containerImagesData = [
  {
    imageId: 'pgadmin:latest',
    imageName: 'pgAdmin 4',
    imageUri: 'demiurge/pgadmin4',
    imageTag: '8.12.0',
    description: 'PostgreSQL administration and development platform',
    category: 'database',
    oauthClients: [
      {
        serviceName: 'pgadmin4',
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
  name: 'pgadmin4',
  version: '0.0.1',
  description: 'pgAdmin database management module',
  dependencies: ['user-containers'],
  load: ({ depsExports }) => {
    depsExports['user-containers'].imageRegistry.register(containerImagesData);
  },
};

