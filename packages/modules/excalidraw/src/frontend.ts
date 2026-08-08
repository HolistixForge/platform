import { TModule } from '@holistix-forge/module';
import { TCollabFrontendExports } from '@holistix-forge/collab/frontend';
import { TWhiteboardFrontendExports } from '@holistix-forge/whiteboard/frontend';

import { layer } from './lib/layer';
import './lib/style.scss';

//

type TRequired = {
  collab: TCollabFrontendExports;
  whiteboard: TWhiteboardFrontendExports;
};

export const moduleFrontend: TModule<TRequired> = {
  name: 'excalidraw',
  version: '1.0.0',
  description: 'Excalidraw module',
  dependencies: [],
  load: ({ depsExports, moduleExports, config }) => {
    // Register shared data schema with registry
    depsExports.collab.registry.registerSharedData(
      'map',
      'excalidraw',
      'elements'
    );

    // No node and no menu entry any more. "New Excalidraw Drawing" created a
    // node whose only purpose was to hold a drawing and open the layer from
    // its Edit button; the layer is the drawing surface itself now, so both
    // the node and the way in are gone.
    depsExports.whiteboard.registerLayer(layer);
  },
};
