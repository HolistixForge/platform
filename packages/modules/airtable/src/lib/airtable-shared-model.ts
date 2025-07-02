import { SharedMap, SharedTypes } from '@monorepo/collab-engine';
import { TAirtableBase, TAirtableBaseSearchResult } from './airtable-types';
import { TAirtableViewMode } from './components/node-airtable/airtable-table';

//

export type TAirtableNodeView = {
    type: 'table';
    baseId: string;
    tableId: string;
    nodeId: string;
    viewId: string;
    viewMode: TAirtableViewMode;
};

export type TAirtableSharedData = {
    airtableBases: SharedMap<TAirtableBase>;
    airtableNodeViews: SharedMap<TAirtableNodeView>;
    airtableBaseSearchResults: SharedMap<TAirtableBaseSearchResult[]>;
};

//

export const Airtable_loadData = (st: SharedTypes): TAirtableSharedData => {
    return {
        airtableBases: st.getSharedMap<TAirtableBase>('module-airtable-v0.1-bases'),
        airtableNodeViews: st.getSharedMap<TAirtableNodeView>('module-airtable-v0.1-node-views'),
        airtableBaseSearchResults: st.getSharedMap<TAirtableBaseSearchResult[]>('module-airtable-v0.1-search-results'),
    };
}; 