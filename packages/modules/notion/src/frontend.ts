import { Notion_loadData } from './lib/notion-shared-model';
import { NodeNotion } from './lib/components/node-notion/node-notion';
import { NodeNotionTask } from './lib/components/node-notion/node-notion-task';
import { ModuleFrontend } from '@monorepo/module/frontend';

export const moduleFrontend: ModuleFrontend = {
  collabChunk: {
    name: 'notion',
    loadSharedData: Notion_loadData,
    deps: [],
  },
  spaceMenuEntries: () => [],
  nodes: {
    'notion-database': NodeNotion,
    'notion-page': NodeNotionTask,
  },
};

export { NewNotionDatabaseForm } from './lib/components/forms/new-database';
export type { NewNotionDatabaseFormData } from './lib/components/forms/new-database';
