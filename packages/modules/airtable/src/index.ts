import { Airtable_loadData } from './lib/airtable-shared-model';
import { AirtableReducer } from './lib/airtable-reducer';
import type { ModuleBackend } from '@monorepo/module';

export const moduleBackend: ModuleBackend = {
  collabChunk: {
    name: 'airtable',
    loadSharedData: Airtable_loadData,
    loadReducers: (sd) => [new AirtableReducer()],
  },
};

export type { TAirtableEvent } from './lib/airtable-events';
export type { TAirtableSharedData } from './lib/airtable-shared-model';
