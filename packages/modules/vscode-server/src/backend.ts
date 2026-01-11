import type { TModule } from '@holistix-forge/module';
import type { TUserContainersExports } from '@holistix-forge/user-containers';

const containerImagesData = [
  {
    imageId: 'vscode-server:latest',
    imageName: 'VS Code Server',
    imageUri: 'holistixforge/vscode-server',
    imageTag: '4.97.1',
    description: 'VS Code Server (code-server) for browser-based development',
    category: 'development',
    oauthClients: [
      {
        serviceName: 'vscode',
        accessTokenLifetime: 31536000,
        redirectPaths: [],
      },
    ],
  },
];

type TRequired = {
  'user-containers': TUserContainersExports;
};

export const moduleBackend: TModule<TRequired> = {
  name: 'vscode-server',
  version: '0.0.1',
  description: 'VS Code Server module for browser-based development',
  dependencies: ['user-containers'],
  load: ({ depsExports }) => {
    depsExports['user-containers'].imageRegistry.register(containerImagesData);
  },
};
