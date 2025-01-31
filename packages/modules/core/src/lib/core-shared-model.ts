import { SharedMap, SharedTypes, SharedArray } from '@monorepo/collab-engine';
import { TGraphNode, TEdge } from './core-types';

export type TProjectMeta = {
  projectActivity: {
    last_activity: string;
    gateway_shutdown: string;
  };
};

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
