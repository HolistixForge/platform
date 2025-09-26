import { ModuleFrontend } from '@monorepo/module/frontend';
import { layers } from './lib/layer';
import { Excalidraw_loadData } from './lib/excalidraw-shared-model';
import { ExcalidrawNode } from './lib/excalidraw-node';
import { excalidrawMenuEntries } from './lib/excalidraw-menu';
import './lib/style.scss';

export const moduleFrontend: ModuleFrontend = {
  collabChunk: {
    name: 'excalidraw',
    loadSharedData: Excalidraw_loadData,
    deps: ['space'],
  },
  nodes: {
    ExcalidrawNode,
  },
  spaceMenuEntries: excalidrawMenuEntries,
  layers,
};
