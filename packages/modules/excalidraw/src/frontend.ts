import { ModuleFrontend } from '@monorepo/module/frontend';
import { layers } from './lib/layer';

export const moduleFrontend: ModuleFrontend = {
  collabChunk: {
    name: 'excalidraw',
    deps: ['space'],
  },
  nodes: {},
  spaceMenuEntries: () => [],
  layers,
};
