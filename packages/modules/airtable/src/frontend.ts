import { NodeAirtableRecord } from './lib/components/node-airtable/node-airtable-record';
import { NodeAirtableKanbanColumn } from './lib/components/node-airtable/node-airtable-kanban-column';
import type { TModule } from '@holistix-forge/module';
import type { TCollabFrontendExports } from '@holistix-forge/collab/frontend';
import type { TWhiteboardFrontendExports } from '@holistix-forge/whiteboard/frontend';
import { airtableMenuEntries } from './lib/airtable-menu';
import { AirtableRightPanel } from './lib/components/node-airtable/right-panel';
import { NodeAirtableTable } from './lib/components/node-airtable/node-airtable-table';

//

type TRequired = {
  collab: TCollabFrontendExports;
  whiteboard: TWhiteboardFrontendExports;
};

export const moduleFrontend: TModule<TRequired> = {
  name: 'airtable',
  version: '0.0.1',
  description: 'Airtable module',
  dependencies: ['core-graph', 'collab', 'whiteboard'],
  load: ({ depsExports }) => {
    depsExports.collab.collab.loadSharedData('map', 'airtable', 'bases');
    depsExports.collab.collab.loadSharedData('map', 'airtable', 'node-views');
    depsExports.collab.collab.loadSharedData(
      'map',
      'airtable',
      'base-search-results'
    );

    depsExports.whiteboard.registerMenuEntries(airtableMenuEntries);
    depsExports.whiteboard.registerNodes({
      'airtable-table': NodeAirtableTable as any,
      'airtable-record': NodeAirtableRecord as any,
      'airtable-kanban-column': NodeAirtableKanbanColumn as any,
    });
    depsExports.whiteboard.registerPanel({
      'airtable-base': AirtableRightPanel,
    });
  },
};
