import { PageConfig } from '@jupyterlab/coreutils';
import { TServersSharedData } from '@monorepo/servers';
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
    deps: ['servers'],
  },
};

export type { TExtraArgs as TJupyterExtraArgs } from './lib/jupyter-reducer';
export type { TJupyterEvent } from './lib/jupyter-events';
export type { TJupyterSharedData } from './lib/jupyter-shared-model';
