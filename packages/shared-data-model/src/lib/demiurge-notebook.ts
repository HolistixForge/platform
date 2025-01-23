import { SharedMap, SharedTypes } from '@monorepo/collab-engine';
import { TServer, TNodeData, TProjectMeta } from '@monorepo/demiurge-types';

export type TDemiurgeNotebookSharedData = {
  meta: SharedMap<TProjectMeta>;
  projectServers: SharedMap<TServer>;
  nodeData: SharedMap<TNodeData>;
};

export const DemiurgeNotebook_loadData = (
  st: SharedTypes
): TDemiurgeNotebookSharedData => {
  return {
    meta: st.getSharedMap('demiurge-meta'),
    nodeData: st.getSharedMap<TNodeData>('demiurge-notebook_nodeData'),
    projectServers: st.getSharedMap('demiurge-notebook_projectServers'),
  };
};
