import { Notion_loadData } from './lib/notion-shared-model';
import { NotionReducer } from './lib/notion-reducer';
import type { ModuleBackend } from '@monorepo/module';

export const moduleBackend: ModuleBackend = {
  collabChunk: {
    name: 'notion',
    loadSharedData: Notion_loadData,
    loadReducers: (sd) => [new NotionReducer()],
    deps: ['config'], // notionApiKey: CONFIG.NOTION_API_KEY
  },
};

export type { TNotionEvent } from './lib/notion-events';
export type { TNotionSharedData } from './lib/notion-shared-model';
