import { NodeNotionDatabase } from './lib/components/node-notion/node-notion-database';
import { NodeNotionTask } from './lib/components/node-notion/node-notion-task';
import type { TModule } from '@holistix-forge/module';
import type { TCollabFrontendExports } from '@holistix-forge/collab/frontend';
import type { TWhiteboardFrontendExports } from '@holistix-forge/whiteboard/frontend';
import { notionMenuEntries } from './lib/notion-menu';
import { NotionRightPanel } from './lib/components/node-notion/right-panel';
import { NodeNotionKanbanColumn } from './lib/components/node-notion/node-notion-kanban-column';

//

type TRequired = {
  collab: TCollabFrontendExports;
  whiteboard: TWhiteboardFrontendExports;
};

export const moduleFrontend: TModule<TRequired> = {
  name: 'notion',
  version: '0.0.1',
  description: 'Notion module',
  dependencies: ['core-graph', 'collab', 'whiteboard'],
  load: ({ depsExports }) => {
    depsExports.collab.collab.loadSharedData('map', 'notion', 'databases');
    depsExports.collab.collab.loadSharedData('map', 'notion', 'node-views');
    depsExports.collab.collab.loadSharedData(
      'map',
      'notion',
      'database-search-results'
    );

    depsExports.whiteboard.registerMenuEntries(notionMenuEntries);
    depsExports.whiteboard.registerNodes({
      'notion-database': NodeNotionDatabase,
      'notion-page': NodeNotionTask,
      'notion-kanban-column': NodeNotionKanbanColumn,
    });
    depsExports.whiteboard.registerPanel({
      'notion-database': NotionRightPanel,
    });
  },
};
