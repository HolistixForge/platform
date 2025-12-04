import { NotionReducer } from './lib/notion-reducer';
import type { TModule } from '@holistix-forge/module';
import type { TCollabBackendExports } from '@holistix-forge/collab';
import type { TReducersBackendExports } from '@holistix-forge/reducers';
import type { TNotionSharedData } from './lib/notion-shared-model';
import type { TCoreSharedData } from '@holistix-forge/core-graph';

type TRequired = {
  collab: TCollabBackendExports<TNotionSharedData & TCoreSharedData>;
  reducers: TReducersBackendExports;
};

export const moduleBackend: TModule<TRequired> = {
  name: 'notion',
  version: '0.0.1',
  description: 'Notion module',
  dependencies: ['core-graph', 'collab', 'reducers'],
  load: ({ depsExports }) => {
    depsExports.collab.collab.loadSharedData('map', 'notion', 'databases');
    depsExports.collab.collab.loadSharedData('map', 'notion', 'node-views');
    depsExports.collab.collab.loadSharedData(
      'map',
      'notion',
      'database-search-results'
    );
    depsExports.reducers.loadReducers(new NotionReducer(depsExports));
  },
};

export type { TNotionEvent } from './lib/notion-events';
export type { TNotionSharedData } from './lib/notion-shared-model';
