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
    // Register shared data schema with registry
    depsExports.collab.registry.registerSharedData('map', 'jupyter', 'servers');

    depsExports.whiteboard.registerMenuEntries(spaceMenuEntrie);
    depsExports.whiteboard.registerNodes({
      'jupyter-cell': NodeCell,
      'jupyter-kernel': NodeKernel,
      'jupyter-terminal': NodeTerminal,
    });

    // TODO: Refactor JLsManager to use per-project collab via getCollabForProject()
    // For now, shared data is resolved lazily at runtime when a project context is available
    const getSharedData = (project_id: string) =>
      depsExports.collab.getCollabForProject(project_id).collab
        .sharedData as TJupyterSharedData & TUserContainersSharedData;

    moduleExports({
      jlsManager: new JLsManager(
        getSharedData as any,
        depsExports.reducers.dispatcher,
        depsExports['user-containers'].getToken
      ),
    });
  },
};
