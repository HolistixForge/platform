import { SharedMap, SharedTypes } from '@monorepo/collab-engine';
import { TNotionDatabase } from './notion-types';

//

export type TNotionSharedData = {
  notionDatabases: SharedMap<TNotionDatabase>;
};

//

export const Notion_loadData = (st: SharedTypes): TNotionSharedData => {
  return {
    notionDatabases: st.getSharedMap<TNotionDatabase>('plugin-notion'),
  };
};
