import { NodeYoutube } from './lib/components/node-video';
import { NodeTextEditor } from './lib/components/text-editor';
import { NodeIdCard } from './lib/components/node-id-card';
import { NodeIframe } from './lib/components/node-iframe';
import { ModuleFrontend } from '@monorepo/module/frontend';
import { socialsMenuEntries } from './lib/socials-menu';
import { NodeReservation } from './lib/components/node-reservation';

export const moduleFrontend: ModuleFrontend = {
  collabChunk: {
    name: 'socials',
    loadSharedData: () => ({}),
    deps: [],
  },
  spaceMenuEntries: socialsMenuEntries,
  nodes: {
    youtube: NodeYoutube,
    'text-editor': NodeTextEditor,
    'node-user': NodeIdCard,
    iframe: NodeIframe,
    'reservation': NodeReservation
  },
};
