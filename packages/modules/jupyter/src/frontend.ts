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
  // `reducers` is read below as `depsExports.reducers.dispatcher`, and was
  // missing here. `TRequired` declares it, so the compiler was satisfied while
  // the loader — which injects from this array, not from the type — handed
  // `undefined`. It went unnoticed because the only story that loaded this
  // module also loaded reducers first for its own reasons; a story that loads
  // the stack in dependency order crashes on it.
  dependencies: [
    'core-graph',
    'collab',
    'whiteboard',
    'user-containers',
    'reducers',
  ],
  load: ({ depsExports, moduleExports }) => {
    // Register shared data schema with registry
    depsExports.collab.registry.registerSharedData('map', 'jupyter', 'servers');

    depsExports.whiteboard.registerMenuEntries(spaceMenuEntrie);
    depsExports.whiteboard.registerNodes({
      'jupyter-cell': NodeCell,
      'jupyter-kernel': NodeKernel,
      'jupyter-terminal': NodeTerminal,
    });

    // Resolved per project, when one is known — see JLsManager.setProjectId.
    // This used to be handed over as `getSharedData as any`, which let a
    // function be indexed as if it were the shared data and made the module
    // throw on load.
    const getSharedData = (project_id: string) =>
      depsExports.collab.getCollabForProject(project_id).collab
        .sharedData as TJupyterSharedData & TUserContainersSharedData;

    moduleExports({
      jlsManager: new JLsManager(
        getSharedData,
        depsExports.reducers.dispatcher,
        depsExports['user-containers'].getToken
      ),
    });
  },
};
