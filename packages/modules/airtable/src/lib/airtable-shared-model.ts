import { SharedMap } from '@holistix-forge/collab-engine';
import { TAirtableBase, TAirtableBaseSearchResult } from './airtable-types';
import { TAirtableViewMode } from './components/node-airtable/node-airtable-table';

//

export type TAirtableNodeView = {
  nodeId: string;
  viewId: string;
  viewMode: TAirtableViewMode;
};

export type TAirtableSharedData = {
  'airtable:bases': SharedMap<TAirtableBase>;
  'airtable:node-views': SharedMap<TAirtableNodeView>;
  'airtable:base-search-results': SharedMap<TAirtableBaseSearchResult[]>;
};
