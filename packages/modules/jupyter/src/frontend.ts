import { ModuleFrontend } from '@monorepo/module/frontend';

import { NodeTerminal } from './lib/components/terminal/terminal';
import { NodeCell } from './lib/components/code-cell/cell';
import { NodeKernel } from './lib/components/node-kernel/node-kernel';
import { Jupyter_Load_Frontend_ExtraContext } from './lib/jupyter-shared-model-front';
import { Jupyter_loadData } from './lib/jupyter-shared-model';
import { spaceMenuEntrie } from './lib/jupyter-menu';

import './lib/index.scss';

//

export const moduleFrontend: ModuleFrontend = {
  collabChunk: {
    name: 'jupyter',
    loadSharedData: Jupyter_loadData,
    loadExtraContext: Jupyter_Load_Frontend_ExtraContext,
    deps: ['servers'],
  },
  spaceMenuEntries: spaceMenuEntrie,
  nodes: {
    'jupyter-cell': NodeCell,
    'jupyter-kernel': NodeKernel,
    'jupyter-terminal': NodeTerminal,
  },
};
