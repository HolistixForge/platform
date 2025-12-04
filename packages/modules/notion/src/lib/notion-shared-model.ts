import { SharedMap } from '@holistix-forge/collab-engine';
import { TNotionDatabase, TNotionDatabaseSearchResult } from './notion-types';
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
  'notion:databases': SharedMap<TNotionDatabase>;
  'notion:node-views': SharedMap<TNotionNodeView>;
  'notion:database-search-results': SharedMap<TNotionDatabaseSearchResult[]>;
};
