import { SharedMap, SharedTypes } from '@monorepo/collab-engine';
import { TNotionDatabase } from './notion-types';
import { TNotionViewMode } from './components/node-notion/notion-database';

//

export type TNotionNodeView = {
  type: 'database';
  databaseId: string;
  nodeId: string;
  viewId: string;
  viewMode: TNotionViewMode;
};

export type TNotionSharedData = {
  notionDatabases: SharedMap<TNotionDatabase>;
  notionNodeViews: SharedMap<TNotionNodeView>;
};

//

export const Notion_loadData = (st: SharedTypes): TNotionSharedData => {
  return {
    notionDatabases: st.getSharedMap<TNotionDatabase>('module-notion-v0.2-databases'),
    notionNodeViews: st.getSharedMap<TNotionNodeView>('module-notion-v0.2-node-views'),
  };
};
