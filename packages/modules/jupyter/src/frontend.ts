import type { TModule } from '@holistix/module';
import type { TCollabFrontendExports } from '@holistix/collab/frontend';
import type { TSpaceFrontendExports } from '@holistix/space/frontend';
import type { TUserContainersFrontendExports } from '@holistix/user-containers/frontend';

import { NodeTerminal } from './lib/components/terminal/terminal';
import { NodeCell } from './lib/components/code-cell/cell';
import { NodeKernel } from './lib/components/node-kernel/node-kernel';
import { Jupyter_Load_Frontend_ExtraContext } from './lib/jupyter-shared-model-front';
import { spaceMenuEntrie } from './lib/jupyter-menu';

import './lib/index.scss';

//

type TRequired = {
  collab: TCollabFrontendExports;
  space: TSpaceFrontendExports;
  'user-containers': TUserContainersFrontendExports;
};

export const moduleFrontend: TModule<TRequired> = {
  name: 'jupyter',
  version: '0.0.1',
  description: 'Jupyter module',
  dependencies: ['core-graph', 'collab', 'space', 'user-containers'],
  load: ({ depsExports, moduleExports }) => {
    depsExports.collab.collab.loadSharedData('map', 'jupyter', 'servers');

    // Load extra context if needed
    const extraContext = Jupyter_Load_Frontend_ExtraContext({
      extraContext: depsExports,
    });

    depsExports.space.registerMenuEntries(spaceMenuEntrie);
    depsExports.space.registerNodes({
      'jupyter-cell': NodeCell,
      'jupyter-kernel': NodeKernel,
      'jupyter-terminal': NodeTerminal,
    });

    if (extraContext) {
      moduleExports(extraContext);
    }
  },
};
