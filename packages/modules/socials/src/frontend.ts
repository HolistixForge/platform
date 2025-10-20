import type { TModule } from '@monorepo/module';
import type { TSpaceFrontendExports } from '@monorepo/space/frontend';

import { NodeYoutube } from './lib/components/node-video';
import { NodeTextEditor } from './lib/components/text-editor';
import { NodeIdCard } from './lib/components/node-id-card';
import { NodeIframe } from './lib/components/node-iframe';
import { socialsMenuEntries } from './lib/socials-menu';
import { NodeReservation } from './lib/components/node-reservation';

type TRequired = {
  space: TSpaceFrontendExports;
};

export const moduleFrontend: TModule<TRequired> = {
  name: 'socials',
  version: '0.0.1',
  description: 'Socials module',
  dependencies: ['space', 'collab', 'gateway'],
  load: ({ depsExports }) => {
    depsExports.space.registerMenuEntries(socialsMenuEntries);
    depsExports.space.registerNodes({
      youtube: NodeYoutube,
      'text-editor': NodeTextEditor,
      'node-user': NodeIdCard,
      iframe: NodeIframe,
      reservation: NodeReservation,
    });
  },
};
