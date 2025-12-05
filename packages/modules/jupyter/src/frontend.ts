import type { TModule } from '@holistix-forge/module';
import type { TCollabFrontendExports } from '@holistix-forge/collab/frontend';
import type { TWhiteboardFrontendExports } from '@holistix-forge/whiteboard/frontend';
import type { TUserContainersFrontendExports } from '@holistix-forge/user-containers/frontend';
import { TUserContainersSharedData } from '@holistix-forge/user-containers';
import { TReducersFrontendExports } from '@holistix-forge/reducers/frontend';

import { NodeTerminal } from './lib/components/terminal/terminal';
import { NodeCell } from './lib/components/code-cell/cell';
import { NodeKernel } from './lib/components/node-kernel/node-kernel';
import { spaceMenuEntrie } from './lib/jupyter-menu';
import { TJupyterSharedData } from './lib/jupyter-shared-model';
import { JLsManager } from './lib/front/jls-manager';

import './lib/index.scss';

//

type TRequired = {
  collab: TCollabFrontendExports;
  whiteboard: TWhiteboardFrontendExports;
  'user-containers': TUserContainersFrontendExports;
  reducers: TReducersFrontendExports;
};

export type TJupyterFrontendExports = {
  jlsManager: JLsManager;
};

export const moduleFrontend: TModule<TRequired> = {
  name: 'jupyter',
  version: '0.0.1',
  description: 'Jupyter module',
  dependencies: ['core-graph', 'collab', 'whiteboard', 'user-containers'],
  load: ({ depsExports, moduleExports }) => {
    depsExports.collab.collab.loadSharedData('map', 'jupyter', 'servers');

    depsExports.whiteboard.registerMenuEntries(spaceMenuEntrie);
    depsExports.whiteboard.registerNodes({
      'jupyter-cell': NodeCell,
      'jupyter-kernel': NodeKernel,
      'jupyter-terminal': NodeTerminal,
    });

    moduleExports({
      jlsManager: new JLsManager(
        depsExports.collab.collab.sharedData as TJupyterSharedData &
          TUserContainersSharedData,
        depsExports.reducers.dispatcher,
        depsExports['user-containers'].getToken
      ),
    });
  },
};
