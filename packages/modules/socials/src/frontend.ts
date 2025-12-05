import type { TModule } from '@holistix-forge/module';
import type { TWhiteboardFrontendExports } from '@holistix-forge/whiteboard/frontend';

import { NodeYoutube } from './lib/components/node-video';
import { NodeTextEditor } from './lib/components/text-editor';
import { NodeIdCard } from './lib/components/node-id-card';
import { NodeIframe } from './lib/components/node-iframe';
import { socialsMenuEntries } from './lib/socials-menu';
import { NodeReservation } from './lib/components/node-reservation';

type TRequired = {
  whiteboard: TWhiteboardFrontendExports;
};

export const moduleFrontend: TModule<TRequired> = {
  name: 'socials',
  version: '0.0.1',
  description: 'Socials module',
  dependencies: ['whiteboard', 'collab', 'gateway'],
  load: ({ depsExports }) => {
    depsExports.whiteboard.registerMenuEntries(socialsMenuEntries);
    depsExports.whiteboard.registerNodes({
      youtube: NodeYoutube,
      'text-editor': NodeTextEditor,
      'node-user': NodeIdCard,
      iframe: NodeIframe,
      reservation: NodeReservation,
    });
  },
};
