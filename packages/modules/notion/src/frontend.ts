import { NodeNotionDatabase } from './lib/components/node-notion/node-notion-database';
import { NodeNotionTask } from './lib/components/node-notion/node-notion-task';
import type { TModule } from '@monorepo/module';
import type { TCollabFrontendExports } from '@monorepo/collab/frontend';
import type { TSpaceFrontendExports } from '@monorepo/space/frontend';
import { notionMenuEntries } from './lib/notion-menu';
import { NotionRightPanel } from './lib/components/node-notion/right-panel';
import { NodeNotionKanbanColumn } from './lib/components/node-notion/node-notion-kanban-column';

//

type TRequired = {
  collab: TCollabFrontendExports;
  space: TSpaceFrontendExports;
};

export const moduleFrontend: TModule<TRequired> = {
  name: 'notion',
  version: '0.0.1',
  description: 'Notion module',
  dependencies: ['core-graph', 'collab', 'space'],
  load: ({ depsExports }) => {
    depsExports.collab.collab.loadSharedData('map', 'notion', 'databases');
    depsExports.collab.collab.loadSharedData('map', 'notion', 'node-views');
    depsExports.collab.collab.loadSharedData(
      'map',
      'notion',
      'database-search-results'
    );

    depsExports.space.registerMenuEntries(notionMenuEntries);
    depsExports.space.registerNodes({
      'notion-database': NodeNotionDatabase,
      'notion-page': NodeNotionTask,
      'notion-kanban-column': NodeNotionKanbanColumn,
    });
    depsExports.space.registerPanel({
      'notion-database': NotionRightPanel,
    });
  },
};
