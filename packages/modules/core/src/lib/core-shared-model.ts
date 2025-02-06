import { SharedMap, SharedTypes, SharedArray } from '@monorepo/collab-engine';
import { TGraphNode, TEdge, TProjectMeta } from './core-types';

export type TCoreSharedData = {
  meta: SharedMap<TProjectMeta>;
  nodes: SharedMap<TGraphNode>;
  edges: SharedArray<TEdge>;
};

export const Core_loadData = (st: SharedTypes): TCoreSharedData => {
  return {
    meta: st.getSharedMap('demiurge-meta'),
    nodes: st.getSharedMap<TGraphNode>('demiurge-nodes'),
    edges: st.getSharedArray<TEdge>('demiurge-edges'),
  };
};
