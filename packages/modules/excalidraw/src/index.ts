import { TModule } from '@holistix-forge/module';
import { TExcalidrawSharedData } from './lib/excalidraw-shared-model';
import { TCollabBackendExports } from '@holistix-forge/collab';

type TRequired = {
  collab: TCollabBackendExports<TExcalidrawSharedData>;
};

export const moduleBackend: TModule<TRequired> = {
  name: 'excalidraw',
  version: '1.0.0',
  description: 'Excalidraw module',
  dependencies: [],
  load: ({ depsExports, moduleExports, config }) => {
    depsExports.collab.collab.loadSharedData('map', 'excalidraw', 'drawing');
  },
};

export type { TExcalidrawSharedData } from './lib/excalidraw-shared-model';
