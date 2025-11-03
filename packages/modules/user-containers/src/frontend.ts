import './lib/index.scss';
import { NodeServer } from './lib/components/node-server/node-server';
import type { TModule } from '@monorepo/module';
import type { TCollabFrontendExports } from '@monorepo/collab/frontend';
import type { TSpaceFrontendExports } from '@monorepo/space/frontend';
import { serversMenuEntries } from './lib/servers-menu';

type TRequired = {
  collab: TCollabFrontendExports;
  space: TSpaceFrontendExports;
};

export const moduleFrontend: TModule<TRequired> = {
  name: 'user-containers',
  version: '0.0.1',
  description: 'User containers module',
  dependencies: ['core-graph', 'collab', 'space', 'tabs'],
  load: ({ depsExports, moduleExports }) => {
    depsExports.collab.collab.loadSharedData(
      'map',
      'user-containers',
      'containers'
    );
    depsExports.collab.collab.loadSharedData(
      'map',
      'user-containers',
      'images'
    );

    depsExports.space.registerMenuEntries(serversMenuEntries);
    depsExports.space.registerNodes({
      'user-container': NodeServer,
    });
  },
};
