import { ModuleFrontend } from '@monorepo/module/frontend';
import { layers } from './lib/layer';
import { Excalidraw_loadData } from './lib/excalidraw-shared-model';
import './lib/style.scss';

export const moduleFrontend: ModuleFrontend = {
  collabChunk: {
    name: 'excalidraw',
    loadSharedData: Excalidraw_loadData,
    deps: ['space'],
  },
  nodes: {},
  spaceMenuEntries: () => [],
  layers,
};
