import { SharedMap, SharedTypes } from '@monorepo/collab-engine';
import { TProjectMeta } from '@monorepo/demiurge-types';

type MinimalNodeData = { id: string; type: string };

export type TCoreSharedData = {
  meta: SharedMap<TProjectMeta>;
  nodeData: SharedMap<MinimalNodeData>;
};

export const Core_loadData = (st: SharedTypes): TCoreSharedData => {
  return {
    meta: st.getSharedMap('demiurge-meta'),
    nodeData: st.getSharedMap<MinimalNodeData>('demiurge-notebook_nodeData'),
  };
};
