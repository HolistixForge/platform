import type { ModuleBackend } from '@monorepo/module';
import { Excalidraw_loadData } from './lib/excalidraw-shared-model';

export const moduleBackend: ModuleBackend = {
  collabChunk: {
    name: 'excalidraw',
    loadSharedData: Excalidraw_loadData,
    loadReducers: (sd) => [],
  },
};

export type { TExcalidrawSharedData } from './lib/excalidraw-shared-model';
