import { TModule } from '@holistix-forge/module';
import { TCollabBackendExports } from '@holistix-forge/collab';
import type { TReducersBackendExports } from '@holistix-forge/reducers';

import { ExcalidrawReducer } from './lib/excalidraw-reducer';

type TRequired = {
  collab: TCollabBackendExports;
  reducers: TReducersBackendExports;
};

export const moduleBackend: TModule<TRequired> = {
  name: 'excalidraw',
  version: '1.0.0',
  description: 'Excalidraw module',
  dependencies: ['collab', 'reducers'],
  load: ({ depsExports }) => {
    // Register shared data schema with registry
    depsExports.collab.registry.registerSharedData(
      'map',
      'excalidraw',
      'elements'
    );
    depsExports.reducers.loadReducers(new ExcalidrawReducer(depsExports));
  },
};

export type {
  TExcalidrawSharedData,
  TExcalidrawElementEntry,
} from './lib/excalidraw-shared-model';
export { elementKey, parseElementKey } from './lib/excalidraw-shared-model';

export type { TExcalidrawEvent } from './lib/excalidraw-events';
