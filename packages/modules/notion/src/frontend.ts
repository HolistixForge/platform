import { Notion_loadData } from './lib/notion-shared-model';
import { NodeNotionDatabase } from './lib/components/node-notion/node-notion-database';
import { NodeNotionTask } from './lib/components/node-notion/node-notion-task';
import { ModuleFrontend } from '@monorepo/module/frontend';
import { notionMenuEntries } from './lib/notion-menu';

//

export const moduleFrontend: ModuleFrontend = {
  collabChunk: {
    name: 'notion',
    loadSharedData: Notion_loadData,
    deps: [],
  },
  spaceMenuEntries: notionMenuEntries,
  nodes: {
    'notion-database': NodeNotionDatabase,
    'notion-page': NodeNotionTask,
  },
};
