import { TModule } from '@holistix-forge/module';
import { TCollabFrontendExports } from '@holistix-forge/collab/frontend';
import { TWhiteboardFrontendExports } from '@holistix-forge/whiteboard/frontend';

import { layer } from './lib/layer';
import { ExcalidrawNode } from './lib/excalidraw-node';
import { excalidrawMenuEntries } from './lib/excalidraw-menu';
import { TExcalidrawSharedData } from './lib/excalidraw-shared-model';

import './lib/style.scss';

//

type TRequired = {
  collab: TCollabFrontendExports<TExcalidrawSharedData>;
  whiteboard: TWhiteboardFrontendExports;
};

export const moduleFrontend: TModule<TRequired> = {
  name: 'excalidraw',
  version: '1.0.0',
  description: 'Excalidraw module',
  dependencies: [],
  load: ({ depsExports, moduleExports, config }) => {
    depsExports.collab.collab.loadSharedData('map', 'excalidraw', 'drawing');

    depsExports.whiteboard.registerMenuEntries(excalidrawMenuEntries);
    depsExports.whiteboard.registerNodes({
      ExcalidrawNode,
    });
    depsExports.whiteboard.registerLayer(layer);
  },
};
