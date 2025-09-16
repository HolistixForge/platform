import { Airtable_loadData } from './lib/airtable-shared-model';
import { NodeAirtableRecord } from './lib/components/node-airtable/node-airtable-record';
import { NodeAirtableKanbanColumn } from './lib/components/node-airtable/node-airtable-kanban-column';
import { ModuleFrontend } from '@monorepo/module/frontend';
import { airtableMenuEntries } from './lib/airtable-menu';
import { AirtableRightPanel } from './lib/components/node-airtable/right-panel';
import { NodeAirtableTable } from './lib/components/node-airtable/node-airtable-table';

//

export const moduleFrontend: ModuleFrontend = {
    collabChunk: {
        name: 'airtable',
        loadSharedData: Airtable_loadData,
        deps: [],
    },
    spaceMenuEntries: airtableMenuEntries,
    nodes: {
        'airtable-table': NodeAirtableTable,
        'airtable-record': NodeAirtableRecord,
        'airtable-kanban-column': NodeAirtableKanbanColumn,
    },
    panels: {
        'airtable-base': AirtableRightPanel,
    },
};
