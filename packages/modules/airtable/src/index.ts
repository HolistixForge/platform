import { AirtableReducer } from './lib/airtable-reducer';
import type { TModule } from '@holistix/module';
import type { TCollabBackendExports } from '@holistix/collab';
import type { TReducersBackendExports } from '@holistix/reducers';
import type { TAirtableSharedData } from './lib/airtable-shared-model';
import type { TCoreSharedData } from '@holistix/core-graph';

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
