import { AirtableReducer } from './lib/airtable-reducer';
import type { TModule } from '@monorepo/module';
import type { TCollabBackendExports } from '@monorepo/collab';
import type { TReducersBackendExports } from '@monorepo/reducers';
import type { TAirtableSharedData } from './lib/airtable-shared-model';
import type { TCoreSharedData } from '@monorepo/core-graph';

type TRequired = {
  collab: TCollabBackendExports<TAirtableSharedData & TCoreSharedData>;
  reducers: TReducersBackendExports;
};

export const moduleBackend: TModule<TRequired> = {
  name: 'airtable',
  version: '0.0.1',
  description: 'Airtable module',
  dependencies: ['core-graph', 'collab', 'reducers'],
  load: ({ depsExports }) => {
    depsExports.collab.collab.loadSharedData('map', 'airtable', 'bases');
    depsExports.collab.collab.loadSharedData('map', 'airtable', 'node-views');
    depsExports.collab.collab.loadSharedData(
      'map',
      'airtable',
      'base-search-results'
    );
    depsExports.reducers.loadReducers(new AirtableReducer(depsExports));
  },
};

export type { TAirtableEvent } from './lib/airtable-events';
export type { TAirtableSharedData } from './lib/airtable-shared-model';
