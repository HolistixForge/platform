import { PageConfig } from '@jupyterlab/coreutils';

PageConfig.setOption('terminalsAvailable', 'true');

export type { TDemiurgeNotebookEvent } from './lib/jupyter-events';

export type { TJupyterSharedData } from './lib/jupyter-shared-model';

export { Jupyter_loadData } from './lib/jupyter-shared-model';

export { JupyterReducer } from './lib/jupyter-reducer';

export type { TExtraArgs as TJupyterExtraArgs } from './lib/jupyter-reducer';
