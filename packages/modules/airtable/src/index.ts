import { AirtableReducer } from './lib/airtable-reducer';
import type { TModule } from '@holistix-forge/module';
import type { TCollabBackendExports } from '@holistix-forge/collab';
import type { TReducersBackendExports } from '@holistix-forge/reducers';

type TRequired = {
  collab: TCollabBackendExports;
  reducers: TReducersBackendExports;
};

export const moduleBackend: TModule<TRequired> = {
  name: 'airtable',
  version: '0.0.1',
  description: 'Airtable module',
  dependencies: ['core-graph', 'collab', 'reducers'],
  load: ({ depsExports }) => {
    // Register shared data schema with registry
    depsExports.collab.registry.registerSharedData('map', 'airtable', 'bases');
    depsExports.collab.registry.registerSharedData(
      'map',
      'airtable',
      'node-views'
    );
    depsExports.collab.registry.registerSharedData(
      'map',
      'airtable',
      'base-search-results'
    );
    depsExports.reducers.loadReducers(new AirtableReducer(depsExports));
  },
};

export type { TAirtableEvent } from './lib/airtable-events';
export type { TAirtableSharedData } from './lib/airtable-shared-model';
