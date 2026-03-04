import { PageConfig } from '@jupyterlab/coreutils';
import { JupyterReducer } from './lib/jupyter-reducer';
import type { TModule } from '@holistix-forge/module';
import type { TCollabBackendExports } from '@holistix-forge/collab';
import type { TReducersBackendExports } from '@holistix-forge/reducers';
import type { TUserContainersExports } from '@holistix-forge/user-containers';

//

PageConfig.setOption('terminalsAvailable', 'true');

export type TJupyterExports = never;

type TRequired = {
  collab: TCollabBackendExports;
  reducers: TReducersBackendExports;
  'user-containers': TUserContainersExports;
};

const containerImagesData = [
  {
    imageId: 'jupyter:minimal',
    imageName: 'JupyterLab Minimal Notebook',
    imageUri: 'holistixforge/jupyterlab-minimal',
    imageTag: 'lab-4.2.0',
    imageSha256:
      '210a80d14fe0175c0fefc2b3c9b6ce25f28b58badb7bf80ce7ce2512d7d2f98b',
    userAvailable: true,
    description: 'Minimal JupyterLab environment with essential packages',
    category: 'development',
    options: {
      containerType: 'jupyter',
      ports: [8888],
      capabilities: ['NET_ADMIN'],
      devices: ['/dev/net/tun'],
    },
  },
  {
    imageId: 'jupyter:pytorch',
    imageName: 'JupyterLab PyTorch Notebook',
    imageUri: 'holistixforge/jupyterlab-pytorch',
    imageTag: 'lab-4.2.0',
    imageSha256:
      '434d01e9b97ed704c366a7d66ea4f285aef3ab040d23761bb67d40749bddd5b0',
    userAvailable: true,
    description: 'JupyterLab with PyTorch and deep learning packages',
    category: 'development',
    options: {
      containerType: 'jupyter',
      ports: [8888],
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
    depsExports.collab.registry.registerSharedData('map', 'jupyter', 'servers');

    // Register container images with user-containers
    depsExports['user-containers'].imageRegistry.register(containerImagesData);

    // Load reducers
    depsExports.reducers.loadReducers(new JupyterReducer(depsExports));
  },
};

export type { TExtraArgs as TJupyterExtraArgs } from './lib/jupyter-reducer';
export type { TJupyterEvent } from './lib/jupyter-events';
export type { TJupyterSharedData } from './lib/jupyter-shared-model';
