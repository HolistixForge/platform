import { PageConfig } from '@jupyterlab/coreutils';
import { TUserContainersSharedData } from '@monorepo/user-containers';
import { JupyterReducer } from './lib/jupyter-reducer';
import type { TModule } from '@monorepo/module';
import type { TCollabBackendExports } from '@monorepo/collab';
import type { TReducersBackendExports } from '@monorepo/reducers';
import type { TUserContainersExports } from '@monorepo/user-containers';
import type { TJupyterSharedData } from './lib/jupyter-shared-model';
import type { TCoreSharedData } from '@monorepo/core-graph';

//

PageConfig.setOption('terminalsAvailable', 'true');

export type TJupyterExports = never;

type TRequired = {
  collab: TCollabBackendExports<
    TUserContainersSharedData & TJupyterSharedData & TCoreSharedData
  >;
  reducers: TReducersBackendExports;
  'user-containers': TUserContainersExports;
};

const containerImagesData = [
  {
    imageId: 'jupyter:minimal',
    imageName: 'JupyterLab Minimal Notebook',
    imageUri: 'public.ecr.aws/f3g9x7j4/demiurge-jmn',
    imageTag: 'lab-4.2.0',
    imageSha256:
      '210a80d14fe0175c0fefc2b3c9b6ce25f28b58badb7bf80ce7ce2512d7d2f98b',
    userAvailable: true,
    description: 'Minimal JupyterLab environment with essential packages',
    category: 'development',
    options: {
      containerType: 'jupyter',
      ports: [8888],
      oauthClients: [
        {
          serviceName: 'jupyterlab',
          accessTokenLifetime: 31536000,
          redirectUris: [
            'https://CONTAINER_SLUG.containers.yourdomain.com/oauth_callback',
          ],
        },
      ],
      capabilities: ['NET_ADMIN'],
      devices: ['/dev/net/tun'],
    },
  },
  {
    imageId: 'jupyter:pytorch',
    imageName: 'JupyterLab PyTorch Notebook',
    imageUri: 'public.ecr.aws/f3g9x7j4/demiurge-jpn',
    imageTag: 'lab-4.2.0',
    imageSha256:
      '434d01e9b97ed704c366a7d66ea4f285aef3ab040d23761bb67d40749bddd5b0',
    userAvailable: true,
    description: 'JupyterLab with PyTorch and deep learning packages',
    category: 'development',
    options: {
      containerType: 'jupyter',
      ports: [8888],
      oauthClients: [
        {
          serviceName: 'jupyterlab',
          accessTokenLifetime: 31536000,
          redirectUris: [
            'https://CONTAINER_SLUG.containers.yourdomain.com/oauth_callback',
          ],
        },
      ],
      capabilities: ['NET_ADMIN'],
      devices: ['/dev/net/tun'],
    },
  },
];

export const moduleBackend: TModule<TRequired, TJupyterExports> = {
  name: 'jupyter',
  version: '0.0.1',
  description: 'Jupyter module',
  dependencies: ['core-graph', 'collab', 'reducers', 'user-containers'],
  load: ({ depsExports, moduleExports }) => {
    // Load shared data
    depsExports.collab.collab.loadSharedData('map', 'jupyter', 'servers');

    // Register container images with user-containers
    depsExports['user-containers'].imageRegistry.register(containerImagesData);

    // Load reducers
    depsExports.reducers.loadReducers(new JupyterReducer(depsExports));
  },
};

export type { TExtraArgs as TJupyterExtraArgs } from './lib/jupyter-reducer';
export type { TJupyterEvent } from './lib/jupyter-events';
export type { TJupyterSharedData } from './lib/jupyter-shared-model';
