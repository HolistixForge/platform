import { TModule } from '@monorepo/module';
import { TCollabFrontendExports } from '@monorepo/collab/frontend';
import { TSpaceFrontendExports } from '@monorepo/space/frontend';

import { layer } from './lib/layer';
import { ExcalidrawNode } from './lib/excalidraw-node';
import { excalidrawMenuEntries } from './lib/excalidraw-menu';
import { TExcalidrawSharedData } from './lib/excalidraw-shared-model';

import './lib/style.scss';

//

type TRequired = {
  collab: TCollabFrontendExports<TExcalidrawSharedData>;
  space: TSpaceFrontendExports;
};

export const moduleFrontend: TModule<TRequired> = {
  name: 'excalidraw',
  version: '1.0.0',
  description: 'Excalidraw module',
  dependencies: [],
  load: ({ depsExports, moduleExports, config }) => {
    depsExports.collab.collab.loadSharedData('map', 'excalidraw', 'drawing');

    depsExports.space.registerMenuEntries(excalidrawMenuEntries);
    depsExports.space.registerNodes({
      ExcalidrawNode,
    });
    depsExports.space.registerLayer(layer);
  },
};
