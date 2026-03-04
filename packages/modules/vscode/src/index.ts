import type { TModule } from '@holistix-forge/module';
import type { TCollabBackendExports } from '@holistix-forge/collab';
import type { TReducersBackendExports } from '@holistix-forge/reducers';
import type { TUserContainersExports } from '@holistix-forge/user-containers';
import type { TContainerImageDefinition } from '@holistix-forge/user-containers';

//

// eslint-disable-next-line @typescript-eslint/no-empty-object-type
export type TVscodeExports = {
  // Module exports - currently empty, will add as needed
};

type TRequired = {
  collab: TCollabBackendExports;
  reducers: TReducersBackendExports;
  'user-containers': TUserContainersExports;
};

export const moduleBackend: TModule<TRequired, TVscodeExports> = {
  name: 'vscode',
  version: '0.0.1',
  description:
    'VS Code container module - provides web-based VS Code environments',
  dependencies: ['core-graph', 'collab', 'reducers', 'user-containers'],
  load: ({ depsExports, moduleExports }) => {
    // Register the VS Code container image with user-containers module
    const vscodeImage: TContainerImageDefinition = {
      imageId: 'vscode:latest',
      imageName: 'VS Code Server',
      imageUri: 'holistixforge/vscode-server',
      imageTag: 'latest',
      description:
        'Web-based VS Code development environment with terminal support',
      category: 'development',
    };

    depsExports['user-containers'].imageRegistry.register([vscodeImage]);

    // Export module API (empty for now)
    moduleExports({});
  },
};
