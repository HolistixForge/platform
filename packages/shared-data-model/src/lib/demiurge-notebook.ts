import { SharedMap, SharedTypes } from '@monorepo/collab-engine';
import { TServer } from '@monorepo/demiurge-types';

export type TNotebookSharedData = {
  projectServers: SharedMap<TServer>;
};

export const Notebook_loadData = (st: SharedTypes): TNotebookSharedData => {
  return {
    projectServers: st.getSharedMap('demiurge-notebook_projectServers'),
  };
};
