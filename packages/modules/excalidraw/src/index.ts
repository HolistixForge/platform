import { TModule } from '@holistix-forge/module';
import { TCollabBackendExports } from '@holistix-forge/collab';

type TRequired = {
  collab: TCollabBackendExports;
};

export const moduleBackend: TModule<TRequired> = {
  name: 'excalidraw',
  version: '1.0.0',
  description: 'Excalidraw module',
  dependencies: [],
  load: ({ depsExports, moduleExports, config }) => {
    // Register shared data schema with registry
    depsExports.collab.registry.registerSharedData(
      'map',
      'excalidraw',
      'drawing'
    );
  },
};

export type { TExcalidrawSharedData } from './lib/excalidraw-shared-model';
