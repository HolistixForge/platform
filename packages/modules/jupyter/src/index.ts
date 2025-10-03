import { PageConfig } from '@jupyterlab/coreutils';
import { TServersSharedData } from '@monorepo/user-containers';
import { TValidSharedData } from '@monorepo/collab-engine';
import { ModuleBackend } from '@monorepo/module';

import { TJupyterSharedData } from './lib/jupyter-shared-model';
import { Jupyter_loadData } from './lib/jupyter-shared-model';
import { JupyterReducer } from './lib/jupyter-reducer';

//

PageConfig.setOption('terminalsAvailable', 'true');

export const moduleBackend: ModuleBackend = {
  collabChunk: {
    name: 'jupyter',
    loadSharedData: Jupyter_loadData,
    loadReducers: (sd: TValidSharedData) => [
      new JupyterReducer(sd as TServersSharedData & TJupyterSharedData),
    ],
    deps: ['user-containers'],
  },
  containerImages: [
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
  ],
};

export type { TExtraArgs as TJupyterExtraArgs } from './lib/jupyter-reducer';
export type { TJupyterEvent } from './lib/jupyter-events';
export type { TJupyterSharedData } from './lib/jupyter-shared-model';
